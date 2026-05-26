const express = require('express');
const router = express.Router();

// POST /api/payments
router.post('/', (req, res) => {
  res.json({ message: 'POST /api/payments — to be implemented' });
});

module.exports = router;
