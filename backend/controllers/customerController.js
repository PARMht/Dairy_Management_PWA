const pool = require('../config/db');

const { getISTDateString } = require('../utils/ist');

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

exports.deactivateCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'UPDATE Customers SET is_active = FALSE WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found or already inactive' });
    }

    res.json({ message: 'Customer deactivated' });
  } catch (error) {
    console.error('Error deactivating customer:', error);
    res.status(500).json({ error: 'Failed to deactivate customer' });
  }
};

exports.toggleSubscriberStatus = async (req, res) => {
  const { id } = req.params;
  const { is_subscriber, product_id, shift, default_qty } = req.body;
  const isSub = is_subscriber === true || is_subscriber === 'true';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT id, is_active FROM Customers WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0 || !existing[0].is_active) {
      await connection.rollback();
      return res.status(404).json({ error: 'Customer not found or not active' });
    }

    await connection.query('UPDATE Customers SET is_subscriber = ? WHERE id = ?', [isSub, id]);

    if (isSub) {
      await connection.query('DELETE FROM Subscriptions WHERE customer_id = ?', [id]);
      await connection.query(
        'INSERT INTO Subscriptions (customer_id, product_id, shift, default_qty) VALUES (?, ?, ?, ?)',
        [id, product_id, shift, default_qty]
      );
    } else {
      await connection.query('DELETE FROM Subscriptions WHERE customer_id = ?', [id]);
    }

    await connection.commit();
    res.json({ message: 'Customer updated' });
  } catch (error) {
    await connection.rollback();
    console.error('Error toggling subscriber status:', error);
    res.status(500).json({ error: 'Failed to update customer status: ' + error.message });
  } finally {
    connection.release();
  }
};

exports.updateSubscription = async (req, res) => {
  const { id } = req.params; // customer_id
  const { product_id, shift, default_qty } = req.body;

  if (product_id === undefined && shift === undefined && default_qty === undefined) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  const updates = [];
  const values = [];

  if (product_id !== undefined) {
    updates.push('product_id = ?');
    values.push(product_id);
  }
  if (shift !== undefined) {
    updates.push('shift = ?');
    values.push(shift);
  }
  if (default_qty !== undefined) {
    updates.push('default_qty = ?');
    values.push(default_qty);
  }

  values.push(id); // customer_id

  try {
    const [result] = await pool.query(
      `UPDATE Subscriptions SET ${updates.join(', ')} WHERE customer_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ message: 'Subscription updated' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};
