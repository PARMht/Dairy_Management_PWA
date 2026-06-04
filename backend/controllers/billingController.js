const pool = require('../config/db');

/**
 * GET /api/billing/:month
 * Returns per-customer bill summary for a given month.
 * :month format is 'YYYY-MM' (e.g. '2026-06')
 */
exports.getMonthlyBill = async (req, res) => {
  const { month } = req.params;

  // Validate format: YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Month must be in YYYY-MM format (e.g. 2026-06)' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM v_monthly_bill WHERE bill_month = ? ORDER BY customer_name`,
      [month]
    );

    // Compute grand totals for the month
    const summary = {
      month,
      customers: rows,
      grand_total_billed: rows.reduce((sum, r) => sum + parseFloat(r.total_billed), 0),
      grand_total_paid: rows.reduce((sum, r) => sum + parseFloat(r.total_paid), 0),
      grand_total_pending: rows.reduce((sum, r) => sum + parseFloat(r.pending_amount), 0),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching monthly bill:', error);
    res.status(500).json({ error: 'Failed to fetch monthly bill' });
  }
};

/**
 * GET /api/billing/customer/:id
 * Returns full ledger for a single customer: all logs + payments + running balance.
 */
exports.getCustomerLedger = async (req, res) => {
  const { id } = req.params;

  try {
    // Get customer balance summary
    const [balanceRows] = await pool.query(
      'SELECT * FROM v_customer_balance WHERE customer_id = ?',
      [id]
    );

    if (balanceRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get all delivery logs for this customer
    const [logs] = await pool.query(
      `SELECT dl.id, dl.product_id, p.name AS product_name, dl.quantity,
              dl.recorded_price, dl.total_charge, dl.shift, dl.log_date
       FROM Daily_Logs dl
       JOIN Products p ON dl.product_id = p.id
       WHERE dl.customer_id = ?
       ORDER BY dl.log_date DESC, dl.created_at DESC`,
      [id]
    );

    // Get all payments for this customer
    const [payments] = await pool.query(
      'SELECT id, amount, method, notes, payment_date FROM Payments WHERE customer_id = ? ORDER BY payment_date DESC, created_at DESC',
      [id]
    );

    res.json({
      balance: balanceRows[0],
      logs,
      payments,
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    res.status(500).json({ error: 'Failed to fetch customer ledger' });
  }
};
