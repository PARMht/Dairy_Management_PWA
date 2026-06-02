const pool = require('../config/db');

// Ensure Idempotency table exists for sync idempotency
pool.query(`
  CREATE TABLE IF NOT EXISTS Idempotency_Keys (
    sync_id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Failed to ensure Idempotency_Keys table:', err));

const getISTDateString = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  return ist.getFullYear() + '-' + String(ist.getMonth() + 1).padStart(2, '0') + '-' + String(ist.getDate()).padStart(2, '0');
};

exports.bulkCreateLogs = async (req, res) => {
  const { sync_id, logs } = req.body; // Expects sync_id and logs array

  if (!sync_id) {
    return res.status(400).json({ error: 'sync_id is required for idempotency' });
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'Expected a non-empty array of log objects' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check idempotency constraint
    try {
      await connection.query('INSERT INTO Idempotency_Keys (sync_id) VALUES (?)', [sync_id]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        // Already processed, simply return success
        await connection.rollback();
        return res.status(200).json({ message: 'Logs already synced', sync_id });
      }
      throw err;
    }

    const logDate = getISTDateString();

    // Map logs to an array of values for bulk insert.
    // Spec: Calculate total_charge (quantity * recorded_price) during insertion.
    // Spec: Enforce Indian Standard Time offset for manual log dates.
    const values = logs.map(log => {
      const total_charge = parseFloat(log.quantity) * parseFloat(log.recorded_price);
      return [
        log.customer_id,
        log.product_id,
        log.quantity,
        log.shift,
        log.recorded_price,
        total_charge,
        log.log_date || logDate
      ];
    });

    // Bulk INSERT syntax with nested array `[values]`
    await connection.query(
      'INSERT INTO Daily_Logs (customer_id, product_id, quantity, shift, recorded_price, total_charge, log_date) VALUES ?',
      [values]
    );

    await connection.commit();
    res.status(201).json({ message: `Successfully inserted \${logs.length} daily logs`, sync_id });
  } catch (error) {
    await connection.rollback();
    console.error('Error in bulk insert:', error);
    res.status(500).json({ error: 'Failed to create bulk logs: ' + error.message });
  } finally {
    connection.release();
  }
};
