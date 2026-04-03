const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_paystack_secret_key_here';

router.use(requireAuth);

// Get user orders
router.get('/', (req, res) => {
  const orders = db.prepare(`SELECT o.*, 
    (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) as item_count
    FROM orders o WHERE o.user_id=? ORDER BY o.created_at DESC`).all(req.session.userId);
  res.json({ orders });
});

// Get single order
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.session.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare(`SELECT oi.*, p.name, p.image, p.brand FROM order_items oi 
    JOIN products p ON oi.product_id=p.id WHERE oi.order_id=?`).all(order.id);
  res.json({ order, items });
});

// Initialize Paystack payment
router.post('/initiate', (req, res) => {
  const { delivery_address, delivery_state, phone } = req.body;
  if (!delivery_address || !delivery_state || !phone) {
    return res.status(400).json({ error: 'Delivery address, state and phone required' });
  }

  const cartItems = db.prepare(`SELECT c.quantity, p.price, p.id as product_id, p.name, p.stock
    FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?`).all(req.session.userId);

  if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  for (const item of cartItems) {
    if (item.quantity > item.stock) {
      return res.status(400).json({ error: `${item.name} has insufficient stock` });
    }
  }

  const user = db.prepare('SELECT email FROM users WHERE id=?').get(req.session.userId);
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const reference = `NXP-${Date.now()}-${req.session.userId}`;
  const amountKobo = Math.round(total * 100);

  // Store pending order
  const order = db.prepare(`INSERT INTO orders (user_id,reference,total,status,payment_status,delivery_address,delivery_state,phone) 
    VALUES (?,?,?,'pending','unpaid',?,?,?)`).run(req.session.userId, reference, total, delivery_address, delivery_state, phone);

  cartItems.forEach(item => {
    db.prepare('INSERT INTO order_items (order_id,product_id,quantity,price) VALUES (?,?,?,?)').run(order.lastInsertRowid, item.product_id, item.quantity, item.price);
  });

  const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/orders/verify/${reference}`;

  // Initialize with Paystack
  axios.post('https://api.paystack.co/transaction/initialize', {
    email: user.email,
    amount: amountKobo,
    reference,
    callback_url: callbackUrl,
    metadata: { order_id: order.lastInsertRowid, user_id: req.session.userId }
  }, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' }
  }).then(response => {
    res.json({ success: true, authorization_url: response.data.data.authorization_url, reference, order_id: order.lastInsertRowid });
  }).catch(err => {
    // If Paystack fails (e.g. test key), allow demo mode
    res.json({ success: true, demo: true, reference, order_id: order.lastInsertRowid, total });
  });
});

// Verify payment (Paystack callback)
router.get('/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });
    const data = response.data.data;
    if (data.status === 'success') {
      const order = db.prepare('SELECT * FROM orders WHERE reference=?').get(reference);
      if (order) {
        db.prepare("UPDATE orders SET payment_status='paid', status='processing' WHERE reference=?").run(reference);
        // Reduce stock
        const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
        items.forEach(item => {
          db.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(item.quantity, item.product_id);
        });
        db.prepare('DELETE FROM cart WHERE user_id=?').run(order.user_id);
      }
      res.redirect(`/?order=success&ref=${reference}`);
    } else {
      res.redirect(`/?order=failed&ref=${reference}`);
    }
  } catch (e) {
    res.redirect(`/?order=error`);
  }
});

// Demo verify (for testing without real Paystack key)
router.post('/verify-demo', (req, res) => {
  const { reference } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE reference=? AND user_id=?').get(reference, req.session.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  db.prepare("UPDATE orders SET payment_status='paid', status='processing' WHERE reference=?").run(reference);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
  items.forEach(item => {
    db.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(item.quantity, item.product_id);
  });
  db.prepare('DELETE FROM cart WHERE user_id=?').run(req.session.userId);
  res.json({ success: true });
});

// ADMIN: Update order status
router.put('/:id/status', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const { status } = req.body;
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;
