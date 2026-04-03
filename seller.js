const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config for product images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP images allowed'));
  }
});

// Middleware: must be logged in + must be approved seller or admin
function requireSeller(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.is_admin || user.is_seller === 1) return next();
  return res.status(403).json({ error: 'Seller account required. Apply to become a seller first.' });
}

// ── SELLER APPLICATION ──────────────────────────────────────────
// Apply to become a seller
router.post('/apply', requireAuth, (req, res) => {
  const { store_name, store_description, bank_name, account_number, account_name } = req.body;
  if (!store_name || !bank_name || !account_number || !account_name) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  if (user.is_seller === 1) return res.status(400).json({ error: 'Already a seller' });
  if (user.seller_status === 'pending') return res.status(400).json({ error: 'Application already pending' });

  db.prepare(`UPDATE users SET store_name=?, store_description=?, bank_name=?, account_number=?, account_name=?, seller_status='pending' WHERE id=?`)
    .run(store_name, store_description, bank_name, account_number, account_name, req.session.userId);
  res.json({ success: true, message: 'Application submitted! We will review within 24 hours.' });
});

// Get seller profile/status
router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,phone,is_seller,is_admin,seller_status,store_name,store_description,bank_name,account_number,account_name FROM users WHERE id=?').get(req.session.userId);
  res.json({ seller: user });
});

// ── SELLER PRODUCTS ─────────────────────────────────────────────
// Get my products
router.get('/products', requireSeller, (req, res) => {
  const products = db.prepare(`SELECT p.*, c.name as category_name,
    (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.product_id=p.id) as total_sold,
    (SELECT SUM(oi.quantity * oi.price) FROM order_items oi WHERE oi.product_id=p.id) as total_revenue
    FROM products p LEFT JOIN categories c ON p.category_id=c.id
    WHERE p.seller_id=? ORDER BY p.created_at DESC`).all(req.session.userId);
  res.json({ products });
});

// Add product with image upload
router.post('/products', requireSeller, upload.array('images', 5), (req, res) => {
  const { name, description, price, old_price, stock, category_id, brand, is_flash_sale, is_new } = req.body;
  if (!name || !price || !stock || !category_id) {
    return res.status(400).json({ error: 'Name, price, stock and category required' });
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

  // Handle uploaded images
  let imageUrl = '📦';
  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = req.files.map(f => '/uploads/' + f.filename);
    imageUrl = imageUrls[0]; // primary image
  }

  const result = db.prepare(`INSERT INTO products 
    (name,slug,description,price,old_price,stock,category_id,brand,image,image_urls,seller_id,is_flash_sale,is_new,is_featured,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,'active')`).run(
    name, slug, description, parseFloat(price), old_price ? parseFloat(old_price) : null,
    parseInt(stock), parseInt(category_id), brand || '', imageUrl,
    JSON.stringify(imageUrls), req.session.userId,
    is_flash_sale ? 1 : 0, is_new ? 1 : 0
  );
  res.json({ success: true, product_id: result.lastInsertRowid });
});

// Update product
router.put('/products/:id', requireSeller, upload.array('images', 5), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=? AND seller_id=?').get(req.params.id, req.session.userId);
  if (!product) return res.status(404).json({ error: 'Product not found or not yours' });

  const { name, description, price, old_price, stock, category_id, brand, is_flash_sale, is_new } = req.body;
  let imageUrl = product.image;
  let imageUrls = product.image_urls;

  if (req.files && req.files.length > 0) {
    const newUrls = req.files.map(f => '/uploads/' + f.filename);
    imageUrl = newUrls[0];
    imageUrls = JSON.stringify(newUrls);
  }

  db.prepare(`UPDATE products SET name=?,description=?,price=?,old_price=?,stock=?,category_id=?,brand=?,image=?,image_urls=?,is_flash_sale=?,is_new=? WHERE id=? AND seller_id=?`)
    .run(name, description, parseFloat(price), old_price ? parseFloat(old_price) : null,
      parseInt(stock), parseInt(category_id), brand, imageUrl, imageUrls,
      is_flash_sale ? 1 : 0, is_new ? 1 : 0, req.params.id, req.session.userId);
  res.json({ success: true });
});

// Delete product
router.delete('/products/:id', requireSeller, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=? AND seller_id=?').get(req.params.id, req.session.userId);
  if (!product) return res.status(404).json({ error: 'Product not found or not yours' });
  db.prepare('UPDATE products SET status=? WHERE id=?').run('deleted', req.params.id);
  res.json({ success: true });
});

// Upload image only (for existing product)
router.post('/products/:id/images', requireSeller, upload.array('images', 5), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=? AND seller_id=?').get(req.params.id, req.session.userId);
  if (!product) return res.status(404).json({ error: 'Not found' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images uploaded' });

  const newUrls = req.files.map(f => '/uploads/' + f.filename);
  const existing = JSON.parse(product.image_urls || '[]');
  const allUrls = [...existing, ...newUrls].slice(0, 5);

  db.prepare('UPDATE products SET image=?, image_urls=? WHERE id=?').run(allUrls[0], JSON.stringify(allUrls), req.params.id);
  res.json({ success: true, images: allUrls });
});

// ── SELLER ORDERS ───────────────────────────────────────────────
// Orders containing my products
router.get('/orders', requireSeller, (req, res) => {
  const orders = db.prepare(`
    SELECT DISTINCT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
      (SELECT SUM(oi2.quantity * oi2.price) FROM order_items oi2 
       JOIN products p2 ON oi2.product_id=p2.id 
       WHERE oi2.order_id=o.id AND p2.seller_id=?) as my_earnings
    FROM orders o
    JOIN order_items oi ON oi.order_id=o.id
    JOIN products p ON oi.product_id=p.id
    JOIN users u ON o.user_id=u.id
    WHERE p.seller_id=?
    ORDER BY o.created_at DESC`).all(req.session.userId, req.session.userId);

  // Attach items per order
  const result = orders.map(order => {
    const items = db.prepare(`SELECT oi.*, p.name, p.image FROM order_items oi 
      JOIN products p ON oi.product_id=p.id WHERE oi.order_id=? AND p.seller_id=?`).all(order.id, req.session.userId);
    return { ...order, items };
  });
  res.json({ orders: result });
});

// ── SELLER ANALYTICS ─────────────────────────────────────────────
router.get('/analytics', requireSeller, (req, res) => {
  const totalProducts = db.prepare("SELECT COUNT(*) as c FROM products WHERE seller_id=? AND status='active'").get(req.session.userId).c;
  const totalOrders = db.prepare(`SELECT COUNT(DISTINCT o.id) as c FROM orders o 
    JOIN order_items oi ON oi.order_id=o.id JOIN products p ON oi.product_id=p.id 
    WHERE p.seller_id=?`).get(req.session.userId).c;
  const revenue = db.prepare(`SELECT COALESCE(SUM(oi.quantity * oi.price),0) as t FROM order_items oi 
    JOIN products p ON oi.product_id=p.id JOIN orders o ON oi.order_id=o.id
    WHERE p.seller_id=? AND o.payment_status='paid'`).get(req.session.userId).t;
  const topProducts = db.prepare(`SELECT p.name, p.image, p.price, COALESCE(SUM(oi.quantity),0) as sold
    FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id
    WHERE p.seller_id=? GROUP BY p.id ORDER BY sold DESC LIMIT 5`).all(req.session.userId);
  const pendingOrders = db.prepare(`SELECT COUNT(DISTINCT o.id) as c FROM orders o 
    JOIN order_items oi ON oi.order_id=o.id JOIN products p ON oi.product_id=p.id
    WHERE p.seller_id=? AND o.status='pending'`).get(req.session.userId).c;

  res.json({ totalProducts, totalOrders, revenue, topProducts, pendingOrders });
});

// ── IMAGE UPLOAD (standalone endpoint for admin too) ─────────────
router.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({ success: true, url: '/uploads/' + req.file.filename });
});

// ── ADMIN: Approve/Reject sellers ───────────────────────────────
router.get('/admin/applications', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const apps = db.prepare("SELECT id,name,email,phone,store_name,store_description,bank_name,account_number,account_name,seller_status,created_at FROM users WHERE seller_status IS NOT NULL AND seller_status != '' AND is_admin=0").all();
  res.json({ applications: apps });
});

router.put('/admin/applications/:id', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const { action } = req.body; // 'approve' or 'reject'
  if (action === 'approve') {
    db.prepare("UPDATE users SET is_seller=1, seller_status='approved' WHERE id=?").run(req.params.id);
  } else {
    db.prepare("UPDATE users SET is_seller=0, seller_status='rejected' WHERE id=?").run(req.params.id);
  }
  res.json({ success: true });
});

module.exports = { router, upload };
