# NexpressNG – Full Stack Ecommerce

Nigeria's #1 online store built with Node.js, SQLite, and Paystack.

## Features
- User registration & login (with sessions)
- Product browsing, search & filtering
- Shopping cart (add, remove, update quantity)
- Wishlist
- Paystack payment integration
- Order tracking
- Customer reviews & ratings
- Admin dashboard (orders, products, revenue)
- 21 products pre-loaded across 12 categories
- Mobile responsive

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Auth**: Session-based (bcryptjs)
- **Payments**: Paystack
- **Frontend**: Vanilla JS SPA

---

## 🚀 Deploy on Render (Step by Step)

### Step 1: Push to GitHub
1. Create account at github.com
2. New repository → name: `nexpressng` → Public
3. Upload ALL files in this folder (keep folder structure!)

### Step 2: Get Paystack Keys
1. Go to dashboard.paystack.com and sign up
2. Go to Settings → API Keys
3. Copy your **Secret Key** (starts with `sk_live_` or `sk_test_`)

### Step 3: Deploy on Render
1. Go to render.com → Sign Up
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub → Select your `nexpressng` repo
4. Render auto-reads `render.yaml`
5. Set Environment Variables:
   - `PAYSTACK_SECRET_KEY` = your Paystack secret key
   - `BASE_URL` = https://nexpressng.onrender.com (your Render URL)
6. Click **"Create Web Service"**

### Step 4: Your site is LIVE! 🎉
URL: `https://nexpressng.onrender.com`

---

## 🔐 Admin Access
Default admin credentials:
- Email: `admin@nexpressng.com`
- Password: `admin123`
**Change these immediately after first login!**

---

## 💳 Paystack Setup
1. Sign up at paystack.com
2. Get your API keys from Settings → API Keys
3. For testing use `sk_test_...` keys
4. For live payments use `sk_live_...` keys
5. Set your webhook URL in Paystack dashboard: `https://yourdomain.com/api/orders/verify/:reference`

---

## 📁 File Structure
```
nexpressng/
├── server.js          ← Main Express server
├── package.json
├── render.yaml        ← Render deployment config
├── .env.example       ← Environment variables template
├── .gitignore
├── db/
│   └── init.js        ← SQLite database + seed data
├── middleware/
│   └── auth.js        ← Authentication middleware
├── routes/
│   ├── auth.js        ← Login, register, profile
│   ├── products.js    ← Products CRUD + reviews
│   ├── cart.js        ← Cart management
│   ├── orders.js      ← Orders + Paystack payment
│   └── misc.js        ← Wishlist, categories, admin stats
└── public/
    └── index.html     ← Full frontend SPA
```

---

## 🌐 Custom Domain
1. Buy domain at namecheap.com or whogohost.com
2. Render Dashboard → Settings → Custom Domain
3. Follow DNS configuration instructions

---

## 🔧 Adding More Products
Log in as admin and use the admin dashboard,
or edit `db/init.js` and redeploy.
