const pool = require('../config/db');

const { getISTDateString } = require('../utils/ist');

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

exports.getLogHistory = async (req, res) => {
  const { page = 1, limit = 20, customer_id, from, to } = req.query;
  const parsedPage = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
  const parsedLimit = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 20;
  const offset = (parsedPage - 1) * parsedLimit;

  let queryParams = [];
  let whereClauses = [];

  if (customer_id) {
    whereClauses.push('dl.customer_id = ?');
    queryParams.push(customer_id);
  }
  if (from) {
    whereClauses.push('dl.log_date >= ?');
    queryParams.push(from);
  }
  if (to) {
    whereClauses.push('dl.log_date <= ?');
    queryParams.push(to);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM Daily_Logs dl ${whereString}`, queryParams);
    const total = countRows[0].total;

    const query = `
      SELECT dl.*, c.name AS customer_name, p.name AS product_name 
      FROM Daily_Logs dl 
      JOIN Customers c ON dl.customer_id = c.id 
      JOIN Products p ON dl.product_id = p.id
      ${whereString}
      ORDER BY log_date DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [logs] = await pool.query(query, [...queryParams, parsedLimit, offset]);

    res.json({ logs, total, page: parsedPage, limit: parsedLimit });
  } catch (error) {
    console.error('Error fetching log history:', error);
    res.status(500).json({ error: 'Failed to fetch log history' });
  }
};

exports.updateLog = async (req, res) => {
  const { id } = req.params;
  const { quantity, recorded_price } = req.body;

  try {
    const [existingRows] = await pool.query('SELECT quantity, recorded_price FROM Daily_Logs WHERE id = ?', [id]);
    
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    const currentLog = existingRows[0];
    const newQuantity = quantity !== undefined ? parseFloat(quantity) : currentLog.quantity;
    const newPrice = recorded_price !== undefined ? parseFloat(recorded_price) : currentLog.recorded_price;
    const newTotal = newQuantity * newPrice;

    await pool.query(
      'UPDATE Daily_Logs SET quantity = ?, recorded_price = ?, total_charge = ? WHERE id = ?',
      [newQuantity, newPrice, newTotal, id]
    );

    res.json({ message: 'Log updated', total_charge: newTotal });
  } catch (error) {
    console.error('Error updating log:', error);
    res.status(500).json({ error: 'Failed to update log' });
  }
};
