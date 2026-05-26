const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');

// GET /api/route?shift=Morning|Afternoon|Evening
router.get('/', routeController.getRoute);

module.exports = router;
