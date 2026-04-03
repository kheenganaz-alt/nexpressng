const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

// CATEGORIES
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json({ categories: cats });
});

// WISHLIST
router.get('/wishlist', requireAuth, (req, res) => {
  const items = db.prepare(`SELECT w.id, p.id as product_id, p.name, p.price, p.old_price, p.image, p.brand, p.rating, p.stock
    FROM wishlist w JOIN products p ON w.product_id=p.id WHERE w.user_id=?`).all(req.session.userId);
  res.json({ items });
});

router.post('/wishlist/toggle', requireAuth, (req, res) => {
  const { product_id } = req.body;
  const existing = db.prepare('SELECT id FROM wishlist WHERE user_id=? AND product_id=?').get(req.session.userId, product_id);
  if (existing) {
    db.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').run(req.session.userId, product_id);
    res.json({ success: true, action: 'removed' });
  } else {
    db.prepare('INSERT INTO wishlist (user_id,product_id) VALUES (?,?)').run(req.session.userId, product_id);
    res.json({ success: true, action: 'added' });
  }
});

// ADMIN STATS
router.get('/admin/stats', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const totalOrders = db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
  const revenue = db.prepare("SELECT SUM(total) as t FROM orders WHERE payment_status='paid'").get().t || 0;
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_admin=0").get().c;
  const totalProducts = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
  const recentOrders = db.prepare(`SELECT o.*, u.name as user_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 10`).all();
  res.json({ totalOrders, revenue, totalUsers, totalProducts, recentOrders });
});

// ADMIN: all orders
router.get('/admin/orders', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const orders = db.prepare(`SELECT o.*, u.name as user_name, u.email FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC`).all();
  res.json({ orders });
});

module.exports = router;
