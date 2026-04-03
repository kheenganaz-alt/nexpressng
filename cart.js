const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Get cart
router.get('/', (req, res) => {
  const items = db.prepare(`SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.old_price, p.image, p.stock, p.brand
    FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?`).all(req.session.userId);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ items, total, count: items.reduce((s, i) => s + i.quantity, 0) });
});

// Add to cart
router.post('/add', (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock < 1) return res.status(400).json({ error: 'Product out of stock' });

  const existing = db.prepare('SELECT * FROM cart WHERE user_id=? AND product_id=?').get(req.session.userId, product_id);
  if (existing) {
    const newQty = existing.quantity + parseInt(quantity);
    if (newQty > product.stock) return res.status(400).json({ error: 'Not enough stock' });
    db.prepare('UPDATE cart SET quantity=? WHERE id=?').run(newQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart (user_id,product_id,quantity) VALUES (?,?,?)').run(req.session.userId, product_id, quantity);
  }
  res.json({ success: true, message: 'Added to cart' });
});

// Update quantity
router.put('/:id', (req, res) => {
  const { quantity } = req.body;
  if (quantity < 1) {
    db.prepare('DELETE FROM cart WHERE id=? AND user_id=?').run(req.params.id, req.session.userId);
  } else {
    db.prepare('UPDATE cart SET quantity=? WHERE id=? AND user_id=?').run(quantity, req.params.id, req.session.userId);
  }
  res.json({ success: true });
});

// Remove item
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM cart WHERE id=? AND user_id=?').run(req.params.id, req.session.userId);
  res.json({ success: true });
});

// Clear cart
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM cart WHERE user_id=?').run(req.session.userId);
  res.json({ success: true });
});

module.exports = router;
