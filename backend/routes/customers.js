const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// 1. Search endpoint (Placed at the top to prevent shadowing)
router.get('/search', customerController.searchInactiveCustomers);

// 2. Base collection routes
router.get('/', customerController.getCustomers);
router.post('/', customerController.createCustomer);

// 3. Customer management routes
router.delete('/:id', customerController.deactivateCustomer);
router.patch('/:id/toggle', customerController.toggleSubscriberStatus);
router.patch('/:id/subscription', customerController.updateSubscription);

module.exports = router;