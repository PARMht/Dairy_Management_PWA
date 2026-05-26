-- ============================================================
-- Dairy Management PWA — Database Schema
-- Run once:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS dairy_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dairy_management;

-- ------------------------------------------------------------
-- 1. Products (milk, paneer, curd, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Products (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  unit          VARCHAR(20)   NOT NULL DEFAULT 'litre',   -- litre, kg, packet
  current_price DECIMAL(8,2)  NOT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. Customers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Customers (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)  NOT NULL,
  phone         VARCHAR(15)   NOT NULL,
  is_subscriber BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. Subscriptions  (only for is_subscriber = true customers)
--    Links a customer to a product + shift + default quantity.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Subscriptions (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT           NOT NULL,
  product_id    INT           NOT NULL,
  shift         ENUM('Morning','Afternoon','Evening') NOT NULL,
  default_qty   DECIMAL(8,2)  NOT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES Products(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. Daily_Logs  (every delivery / ad-hoc sale)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Daily_Logs (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT           NOT NULL,
  product_id      INT           NOT NULL,
  quantity        DECIMAL(8,2)  NOT NULL,
  shift           ENUM('Morning','Afternoon','Evening') DEFAULT NULL,
  recorded_price  DECIMAL(8,2)  NOT NULL,          -- price at time of sale
  total_charge    DECIMAL(10,2) NOT NULL,           -- quantity × recorded_price
  log_date        DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES Products(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. Payments  (cash / UPI received against arrears)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Payments (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT           NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  method        VARCHAR(20)   NOT NULL DEFAULT 'Cash',  -- Cash, UPI
  notes         TEXT          DEFAULT NULL,
  payment_date  DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Seed a couple of default products so the app is usable
-- ============================================================
INSERT INTO Products (name, unit, current_price) VALUES
  ('Full-Cream Milk', 'litre', 70.00),
  ('Toned Milk',      'litre', 55.00),
  ('Paneer',          'kg',    350.00),
  ('Curd',            'kg',    60.00);
