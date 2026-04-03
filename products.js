const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireAdmin } = require('../middleware/auth');

// Get all products with filters
router.get('/', (req, res) => {
  const { category, search, sort, flash, featured, newArrivals, page = 1, limit = 20 } = req.query;
  let query = `SELECT p.*, c.name as category_name, c.slug as category_slug 
               FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
  const params = [];

  if (category) { query += ' AND c.slug=?'; params.push(category); }
  if (flash) { query += ' AND p.is_flash_sale=1'; }
  if (featured) { query += ' AND p.is_featured=1'; }
  if (newArrivals) { query += ' AND p.is_new=1'; }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const sortMap = {
    'price-asc': 'p.price ASC',
    'price-desc': 'p.price DESC',
    'rating': 'p.rating DESC',
    'newest': 'p.created_at DESC',
    'popular': 'p.review_count DESC',
  };
  query += ` ORDER BY ${sortMap[sort] || 'p.is_featured DESC, p.created_at DESC'}`;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const products = db.prepare(query).all(...params);
  res.json({ products });
});

// Get single product
router.get('/:slug', (req, res) => {
  const p = db.prepare(`SELECT p.*, c.name as category_name FROM products p 
    LEFT JOIN categories c ON p.category_id=c.id WHERE p.slug=?`).get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const reviews = db.prepare(`SELECT r.*, u.name as user_name FROM reviews r 
    JOIN users u ON r.user_id=u.id WHERE r.product_id=? ORDER BY r.created_at DESC LIMIT 10`).all(p.id);
  res.json({ product: p, reviews });
});

// Add review
router.post('/:id/review', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });
  db.prepare('INSERT OR REPLACE INTO reviews (user_id,product_id,rating,comment) VALUES (?,?,?,?)').run(req.session.userId, req.params.id, rating, comment);
  const avg = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id=?').get(req.params.id);
  db.prepare('UPDATE products SET rating=?, review_count=? WHERE id=?').run(Math.round(avg.avg * 10) / 10, avg.cnt, req.params.id);
  res.json({ success: true });
});

// ADMIN: Add product
router.post('/', requireAdmin, (req, res) => {
  const { name, description, price, old_price, stock, category_id, brand, image, is_flash_sale, is_featured, is_new } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  db.prepare(`INSERT INTO products (name,slug,description,price,old_price,stock,category_id,brand,image,is_flash_sale,is_featured,is_new) 
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(name, slug, description, price, old_price, stock, category_id, brand, image || '📦', is_flash_sale ? 1 : 0, is_featured ? 1 : 0, is_new ? 1 : 0);
  res.json({ success: true });
});

// ADMIN: Update product
router.put('/:id', requireAdmin, (req, res) => {
  const { name, description, price, old_price, stock, brand, image, is_flash_sale, is_featured, is_new } = req.body;
  db.prepare(`UPDATE products SET name=?,description=?,price=?,old_price=?,stock=?,brand=?,image=?,is_flash_sale=?,is_featured=?,is_new=? WHERE id=?`)
    .run(name, description, price, old_price, stock, brand, image, is_flash_sale ? 1 : 0, is_featured ? 1 : 0, is_new ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// ADMIN: Delete product
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
