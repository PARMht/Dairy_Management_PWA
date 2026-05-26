const pool = require('../config/db');

exports.getRoute = async (req, res) => {
  const shift = req.query.shift;

  if (!shift) {
    return res.status(400).json({ error: 'Shift query parameter is required (Morning, Afternoon, Evening)' });
  }

  try {
    // Spec: Joins Subscriptions and Customers tables to return array of customers 
    // assigned to requested shift, including default_qty and current_price.
    const [rows] = await pool.query(`
      SELECT 
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone,
        s.product_id,
        p.name AS product_name,
        p.current_price,
        s.default_qty,
        s.shift
      FROM Customers c
      JOIN Subscriptions s ON c.id = s.customer_id
      JOIN Products p ON s.product_id = p.id
      WHERE s.shift = ? AND c.is_subscriber = TRUE
    `, [shift]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Failed to fetch daily route' });
  }
};
