const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

// GET /api/billing/customer/:id  — full customer ledger
// (must be before /:month so 'customer' isn't treated as a month param)
router.get('/customer/:id', billingController.getCustomerLedger);

// GET /api/billing/:month  — monthly bill summary (format: YYYY-MM)
router.get('/:month', billingController.getMonthlyBill);

module.exports = router;
