const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// POST /api/logs/bulk
router.post('/bulk', logController.bulkCreateLogs);

module.exports = router;
