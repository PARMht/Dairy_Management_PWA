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

exports.createProduct = async (req, res) => {
  const { name, unit, current_price } = req.body;

  if (!name || current_price === undefined) {
    return res.status(400).json({ error: 'name and current_price are required' });
  }

  const productUnit = unit || 'litre';

  try {
    const [result] = await pool.query(
      'INSERT INTO Products (name, unit, current_price) VALUES (?, ?, ?)',
      [name, productUnit, current_price]
    );
    res.status(201).json({ product_id: result.insertId });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, unit, current_price } = req.body;

  if (name === undefined && unit === undefined && current_price === undefined) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (unit !== undefined) {
    updates.push('unit = ?');
    values.push(unit);
  }
  if (current_price !== undefined) {
    updates.push('current_price = ?');
    values.push(current_price);
  }

  values.push(id);

  try {
    const [result] = await pool.query(
      `UPDATE Products SET ${updates.join(', ')} WHERE id = ? AND is_active = TRUE`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found or not active' });
    }

    res.json({ message: 'Product updated' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

exports.deactivateProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'UPDATE Products SET is_active = FALSE WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deactivated' });
  } catch (error) {
    console.error('Error deactivating product:', error);
    res.status(500).json({ error: 'Failed to deactivate product' });
  }
};
