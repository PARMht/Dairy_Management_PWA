const pool = require('../config/db');

exports.getProducts = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id AS product_id, name, current_price FROM Products WHERE is_active = TRUE'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};
