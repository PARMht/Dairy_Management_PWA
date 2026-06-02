const pool = require('../config/db');

const getISTDateString = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  return ist.getFullYear() + '-' + String(ist.getMonth() + 1).padStart(2, '0') + '-' + String(ist.getDate()).padStart(2, '0');
};

exports.getCustomers = async (req, res) => {
  try {
    const isSubscriber = req.query.is_subscriber === 'true';

    // Parameterized query to prevent SQL injection, explicitly filtering for active customers
    const [rows] = await pool.query(
      'SELECT * FROM Customers WHERE is_subscriber = ? AND is_active = TRUE',
      [isSubscriber]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

exports.searchInactiveCustomers = async (req, res) => {
  try {
    const phone = req.query.phone || '';
    const [rows] = await pool.query(
      'SELECT id, name, phone FROM Customers WHERE phone LIKE ? AND is_active = FALSE LIMIT 5',
      [`%${phone}%`]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error searching inactive customers:', error);
    res.status(500).json({ error: 'Failed to search inactive customers' });
  }
};

exports.createCustomer = async (req, res) => {
  const { name, phone, is_subscriber, product_id, shift, default_qty, quantity } = req.body;
  const isSub = is_subscriber === true || is_subscriber === 'true';

  const connection = await pool.getConnection();
  try {
    // Start a transaction since we are inserting into multiple tables
    await connection.beginTransaction();

    // The Upsert Pattern
    // Before inserting, check if the provided phone number exists.
    const [existing] = await connection.query('SELECT id, is_active FROM Customers WHERE phone = ?', [phone]);

    let customerId;

    if (existing.length > 0) {
      const customer = existing[0];
      if (customer.is_active) {
        // If it exists and is_active = TRUE: Return a 409 Conflict
        await connection.rollback();
        return res.status(409).json({ message: "A customer with this phone number is already active." });
      } else {
        // If it exists and is_active = FALSE: UPDATE to set is_active = TRUE and update the name.
        await connection.query('UPDATE Customers SET is_active = TRUE, is_subscriber = ?, name = ? WHERE id = ?', [isSub, name, customer.id]);
        customerId = customer.id;

        // Wipe old subscriptions for this user first
        await connection.query('DELETE FROM Subscriptions WHERE customer_id = ?', [customerId]);
      }
    } else {
      // If it does not exist: Proceed with the standard INSERT.
      const [customerResult] = await connection.query(
        'INSERT INTO Customers (name, phone, is_subscriber) VALUES (?, ?, ?)',
        [name, phone, isSub]
      );
      customerId = customerResult.insertId;
    }

    if (isSub) {
      // Insert into Subscriptions
      await connection.query(
        'INSERT INTO Subscriptions (customer_id, product_id, shift, default_qty) VALUES (?, ?, ?, ?)',
        [customerId, product_id, shift, default_qty]
      );
    } else {
      // Insert immediate one-off record into Daily_Logs

      // Fetch current price from Products
      const [productRows] = await connection.query(
        'SELECT current_price FROM Products WHERE id = ?',
        [product_id]
      );

      if (productRows.length === 0) {
        throw new Error('Product not found');
      }

      const recordedPrice = productRows[0].current_price;
      const totalCharge = parseFloat(recordedPrice) * parseFloat(quantity);
      const logDate = getISTDateString();

      await connection.query(
        'INSERT INTO Daily_Logs (customer_id, product_id, quantity, recorded_price, total_charge, log_date) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, product_id, quantity, recordedPrice, totalCharge, logDate]
      );
    }

    // Commit transaction
    await connection.commit();
    res.status(201).json({ message: 'Customer processed successfully', customerId });
  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    console.error('Error creating/updating customer:', error);
    res.status(500).json({ error: 'Failed to process customer: ' + error.message });
  } finally {
    // Always release the connection back to the pool
    connection.release();
  }
};
