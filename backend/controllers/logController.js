const pool = require('../config/db');

exports.bulkCreateLogs = async (req, res) => {
  const logs = req.body; // Expects an array of log objects

  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'Expected a non-empty array of log objects' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Map logs to an array of values for bulk insert.
    // Spec: Calculate total_charge (quantity * recorded_price) during insertion.
    const values = logs.map(log => {
      const total_charge = parseFloat(log.quantity) * parseFloat(log.recorded_price);
      return [
        log.customer_id, 
        log.product_id, 
        log.quantity, 
        log.shift, 
        log.recorded_price, 
        total_charge
      ];
    });

    // Bulk INSERT syntax with nested array `[values]`
    await connection.query(
      'INSERT INTO Daily_Logs (customer_id, product_id, quantity, shift, recorded_price, total_charge) VALUES ?',
      [values]
    );

    await connection.commit();
    res.status(201).json({ message: `Successfully inserted ${logs.length} daily logs` });
  } catch (error) {
    await connection.rollback();
    console.error('Error in bulk insert:', error);
    res.status(500).json({ error: 'Failed to create bulk logs: ' + error.message });
  } finally {
    connection.release();
  }
};
