const pool = require('../config/db');

exports.getCustomers = async (req, res) => {
  try {
    const isSubscriber = req.query.is_subscriber === 'true';
    
    // Parameterized query to prevent SQL injection
    const [rows] = await pool.query(
      'SELECT * FROM Customers WHERE is_subscriber = ?',
      [isSubscriber]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

exports.createCustomer = async (req, res) => {
  const { name, phone, is_subscriber, product_id, shift, default_qty, quantity } = req.body;
  const isSub = is_subscriber === true || is_subscriber === 'true';

  const connection = await pool.getConnection();
  try {
    // Start a transaction since we are inserting into multiple tables
    await connection.beginTransaction();

    // 1. Insert into Customers
    const [customerResult] = await connection.query(
      'INSERT INTO Customers (name, phone, is_subscriber) VALUES (?, ?, ?)',
      [name, phone, isSub]
    );
    const customerId = customerResult.insertId;

    if (isSub) {
      // 2. If true: Insert into Subscriptions
      await connection.query(
        'INSERT INTO Subscriptions (customer_id, product_id, shift, default_qty) VALUES (?, ?, ?, ?)',
        [customerId, product_id, shift, default_qty]
      );
    } else {
      // 3. If false: Insert immediate one-off record into Daily_Logs
      
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

      await connection.query(
        'INSERT INTO Daily_Logs (customer_id, product_id, quantity, recorded_price, total_charge) VALUES (?, ?, ?, ?, ?)',
        [customerId, product_id, quantity, recordedPrice, totalCharge]
      );
    }

    // Commit transaction
    await connection.commit();
    res.status(201).json({ message: 'Customer created successfully', customerId });
  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer: ' + error.message });
  } finally {
    // Always release the connection back to the pool
    connection.release();
  }
};
