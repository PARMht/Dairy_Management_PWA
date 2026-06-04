const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// GET /api/payments/balance/:customer_id
router.get('/balance/:customer_id', paymentController.getCustomerBalance);

// GET /api/payments/:customer_id
router.get('/:customer_id', paymentController.getPaymentsByCustomer);

// POST /api/payments
router.post('/', paymentController.createPayment);

module.exports = router;
