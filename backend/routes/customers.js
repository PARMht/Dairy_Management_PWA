const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// 1. Search endpoint (Placed at the top to prevent shadowing)
router.get('/search', customerController.searchInactiveCustomers);

// 2. Base collection routes
router.get('/', customerController.getCustomers);
router.post('/', customerController.createCustomer);

module.exports = router;