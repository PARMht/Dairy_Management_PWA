const pool = require('../config/db');
const { getISTDateString } = require('../utils/ist');

exports.createPayment = async (req, res) => {
  const { customer_id, amount, method, notes } = req.body;

  if (!customer_id || amount === undefined || amount <= 0) {
    return res.status(400).json({ error: 'Valid customer_id and amount (> 0) are required' });
  }

  const paymentMethod = method || 'Cash';
  const paymentNotes = notes || null;
  const paymentDate = getISTDateString();

  try {
    const [result] = await pool.query(
      'INSERT INTO Payments (customer_id, amount, method, notes, payment_date) VALUES (?, ?, ?, ?, ?)',
      [customer_id, amount, paymentMethod, paymentNotes, paymentDate]
    );
    res.status(201).json({ payment_id: result.insertId });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

exports.getPaymentsByCustomer = async (req, res) => {
  const { customer_id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM Payments WHERE customer_id = ? ORDER BY payment_date DESC, created_at DESC',
      [customer_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

exports.getCustomerBalance = async (req, res) => {
  const { customer_id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM v_customer_balance WHERE customer_id = ?',
      [customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer balance not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching customer balance:', error);
    res.status(500).json({ error: 'Failed to fetch customer balance' });
  }
};
