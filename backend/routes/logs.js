const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// GET /api/logs
router.get('/', logController.getLogHistory);

// POST /api/logs/bulk
router.post('/bulk', logController.bulkCreateLogs);

// PATCH /api/logs/:id
router.patch('/:id', logController.updateLog);

module.exports = router;
