const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

// ── Route imports ────────────────────────────────────────────
const customerRoutes = require('./routes/customers');
const routeRoutes    = require('./routes/route');
const logRoutes      = require('./routes/logs');
const paymentRoutes  = require('./routes/payments');
const productRoutes  = require('./routes/products');
const billingRoutes  = require('./routes/billing');

// ── App init ─────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());                         // allow cross-origin from React dev server
app.use(express.json());                 // parse JSON request bodies

// ── Health-check ─────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('DB health-check failed:', err.message);
    res.status(500).json({ status: 'error', db: err.message });
  }
});

// ── API routes ───────────────────────────────────────────────
app.use('/api/customers', customerRoutes);
app.use('/api/route',     routeRoutes);
app.use('/api/logs',      logRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/billing',   billingRoutes);

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🥛 Dairy Management API running on http://localhost:${PORT}`);
});
