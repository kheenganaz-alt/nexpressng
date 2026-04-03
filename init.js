const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../db/nexpressng.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// USERS
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    state TEXT,
    is_admin INTEGER DEFAULT 0,
    is_seller INTEGER DEFAULT 0,
    seller_status TEXT DEFAULT '',
    store_name TEXT DEFAULT '',
    store_description TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    account_number TEXT DEFAULT '',
    account_name TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// CATEGORIES
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    description TEXT
  )
`);

// PRODUCTS
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    old_price REAL,
    stock INTEGER DEFAULT 0,
    category_id INTEGER,
    brand TEXT,
    image TEXT DEFAULT '📦',
    image_urls TEXT DEFAULT '[]',
    seller_id INTEGER DEFAULT NULL,
    status TEXT DEFAULT 'active',
    rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    is_flash_sale INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  )
`);

// CART
db.exec(`
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE(user_id, product_id)
  )
`);

// ORDERS
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    delivery_address TEXT,
    delivery_state TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// ORDER ITEMS
db.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )
`);

// WISHLIST
db.exec(`
  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )
`);

// REVIEWS
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )
`);

// SEED CATEGORIES
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
if (catCount.c === 0) {
  const cats = [
    ['Phones & Tablets', 'phones', '📱'],
    ['Computers', 'computers', '💻'],
    ['Electronics', 'electronics', '📺'],
    ['Women Fashion', 'women-fashion', '👗'],
    ['Men Fashion', 'men-fashion', '👔'],
    ['Home & Living', 'home-living', '🏠'],
    ['Kitchen', 'kitchen', '🍳'],
    ['Health & Beauty', 'health-beauty', '🧴'],
    ['Baby Products', 'baby', '👶'],
    ['Groceries', 'groceries', '🍔'],
    ['Sports', 'sports', '⚽'],
    ['Automotive', 'automotive', '🚗'],
  ];
  const ins = db.prepare('INSERT INTO categories (name,slug,icon) VALUES (?,?,?)');
  cats.forEach(c => ins.run(...c));
}

// SEED PRODUCTS
const prodCount = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (prodCount.c === 0) {
  const products = [
    // Phones
    ['Tecno Spark 20 Pro 8GB RAM 256GB', 'tecno-spark-20-pro', 'Latest Tecno with massive RAM and stunning display. Perfect for gaming and multitasking.', 89500, 140000, 45, 1, 'Tecno', '📱', 4.5, 1240, 1, 1, 0],
    ['Samsung Galaxy A55 5G 256GB', 'samsung-a55-5g', 'Samsung flagship killer with amazing camera and 5G connectivity.', 185000, 220000, 30, 1, 'Samsung', '📱', 4.7, 890, 0, 1, 1],
    ['iPhone 15 128GB', 'iphone-15-128gb', 'Apple iPhone 15 with advanced camera system and A16 chip.', 890000, 1050000, 15, 1, 'Apple', '🍎', 4.9, 2400, 0, 1, 0],
    ['Infinix Hot 40i 8GB', 'infinix-hot-40i', 'Budget powerhouse with big battery and fast charging.', 62000, 82000, 60, 1, 'Infinix', '📱', 4.3, 560, 1, 0, 0],
    // Computers
    ['HP Pavilion 15 Intel i5 16GB', 'hp-pavilion-15-i5', 'HP laptop perfect for work and study. Fast SSD and FHD display.', 285000, 400000, 20, 2, 'HP', '💻', 4.4, 560, 1, 1, 0],
    ['Dell Inspiron 14 AMD Ryzen 5', 'dell-inspiron-14-ryzen5', 'Slim Dell laptop with great battery life and AMD performance.', 320000, 420000, 18, 2, 'Dell', '💻', 4.5, 340, 0, 1, 1],
    ['Lenovo IdeaPad Slim 3', 'lenovo-ideapad-slim3', 'Lightweight and affordable laptop for everyday use.', 195000, 240000, 35, 2, 'Lenovo', '💻', 4.2, 780, 1, 0, 0],
    // Electronics
    ['Samsung 55" 4K Smart TV', 'samsung-55-4k-tv', 'Crystal clear 4K picture with built-in streaming apps.', 320000, 390000, 12, 3, 'Samsung', '📺', 4.7, 3400, 0, 1, 0],
    ['Sony WH-1000XM5 Headphones', 'sony-wh1000xm5', 'Industry-leading noise cancellation headphones. 30hr battery.', 45000, 75000, 25, 3, 'Sony', '🎧', 4.8, 890, 1, 1, 0],
    ['LG 1.5HP Split AC Unit', 'lg-1-5hp-split-ac', 'Energy-saving inverter AC. Cools fast and runs quiet.', 185000, 220000, 10, 3, 'LG', '❄️', 4.6, 450, 0, 1, 0],
    // Fashion
    ['Zara Floral Midi Dress', 'zara-floral-midi-dress', 'Elegant floral dress perfect for any occasion. Available in all sizes.', 18500, 27000, 100, 4, 'Zara', '👗', 4.6, 1800, 1, 1, 0],
    ['H&M Summer Collection Blouse', 'hm-summer-blouse', 'Breathable summer blouse in multiple colours.', 8500, 12000, 200, 4, 'H&M', '👚', 4.4, 920, 0, 0, 1],
    ['Nike Air Max 270 Sneakers', 'nike-air-max-270', 'Iconic Nike comfort and style. Perfect for every day.', 28000, 48000, 40, 5, 'Nike', '👟', 4.6, 2100, 1, 1, 0],
    ['Adidas Classic Track Suit', 'adidas-tracksuit', 'Premium Adidas tracksuit. Comfortable and stylish.', 22000, 35000, 55, 5, 'Adidas', '🧥', 4.5, 670, 0, 1, 0],
    // Home
    ['Midea 3-Burner Gas Cooker', 'midea-3-burner-gas', 'Durable gas cooker with auto-ignition. Perfect for Nigerian kitchens.', 42000, 58000, 30, 7, 'Midea', '🍳', 4.5, 780, 0, 1, 0],
    ['Thermocool 300L Chest Freezer', 'thermocool-300l-freezer', 'Large chest freezer. Ideal for home and business.', 175000, 210000, 15, 6, 'Thermocool', '🧊', 4.6, 340, 0, 1, 0],
    ['Zara Home Bedsheet Set King', 'zara-home-bedsheet-king', '100% cotton luxury bedsheets with pillowcases.', 12500, 18000, 80, 6, 'Zara Home', '🛏️', 4.7, 1200, 1, 0, 0],
    // Health
    ['Nivea Men Complete Combo Pack', 'nivea-men-combo', 'Complete skincare set for men. Face wash, moisturizer and more.', 8500, 12000, 150, 8, 'Nivea', '🧴', 4.3, 4200, 1, 0, 0],
    ['Gillette Fusion ProGlide Razor', 'gillette-fusion-proglide', 'Close shave with 5-blade razor. Refill compatible.', 4500, 6500, 200, 8, 'Gillette', '🪒', 4.5, 2100, 0, 0, 0],
    // Gaming/New
    ['PlayStation 5 Slim Disc Edition', 'ps5-slim-disc', 'Sony PS5 Slim. Next-gen gaming experience.', 650000, null, 8, 3, 'Sony', '🎮', 4.9, 2900, 0, 1, 1],
    ['Apple Watch Series 10 45mm', 'apple-watch-s10-45mm', 'Advanced health tracking and stunning always-on display.', 420000, null, 20, 3, 'Apple', '⌚', 4.8, 1100, 0, 1, 1],
  ];
  const ins = db.prepare(`INSERT INTO products 
    (name,slug,description,price,old_price,stock,category_id,brand,image,rating,review_count,is_flash_sale,is_featured,is_new) 
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  products.forEach(p => ins.run(...p));

  // Admin user
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT OR IGNORE INTO users (name,email,password,is_admin) VALUES (?,?,?,?)').run('Admin', 'admin@nexpressng.com', hash, 1);
}

module.exports = db;
