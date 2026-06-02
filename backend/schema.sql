-- ============================================================
-- Dairy Management PWA — Database Schema (v2.0)
-- Run once:  mysql -u root -p < schema.sql
--
-- Design principles:
--   • Soft-delete via is_active flags (no rows are ever destroyed)
--   • ON DELETE RESTRICT everywhere — the DB blocks hard deletes
--     so financial ledger data (Daily_Logs, Payments) is safe
--   • UNIQUE phone constraint at the database level
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
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,      -- soft-delete flag
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
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,      -- soft-delete flag
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_customer_phone (phone)                    -- prevent duplicate registrations
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. Subscriptions  (only for is_subscriber = true customers)
--    Links a customer to a product + shift + default quantity.
--
--    FK strategy:
--      • customer → RESTRICT  (soft-delete the customer instead)
--      • product  → RESTRICT  (soft-delete the product instead)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Subscriptions (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT           NOT NULL,
  product_id    INT           NOT NULL,
  shift         ENUM('Morning','Afternoon','Evening') NOT NULL,
  default_qty   DECIMAL(8,2)  NOT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id)  REFERENCES Products(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. Daily_Logs  (every delivery / ad-hoc sale)
--    This is immutable ledger data — nothing referencing it
--    should ever be hard-deleted.
--
--    FK strategy:
--      • customer → RESTRICT  (ledger row must survive)
--      • product  → RESTRICT  (ledger row must survive)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Daily_Logs (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT           NOT NULL,
  product_id      INT           NOT NULL,
  quantity        DECIMAL(8,2)  NOT NULL,
  shift           ENUM('Morning','Afternoon','Evening') DEFAULT NULL,
  recorded_price  DECIMAL(8,2)  NOT NULL,          -- price snapshot at time of sale
  total_charge    DECIMAL(10,2) NOT NULL,           -- quantity × recorded_price
  log_date        DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id)  REFERENCES Products(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. Payments  (cash / UPI received against arrears)
--    Also immutable ledger data.
--
--    FK strategy:
--      • customer → RESTRICT  (payment record must survive)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Payments (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT           NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  method        VARCHAR(20)   NOT NULL DEFAULT 'Cash',  -- Cash, UPI
  notes         TEXT          DEFAULT NULL,
  payment_date  DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- Seed default products (all active by default)
-- ============================================================
INSERT INTO Products (name, unit, current_price) VALUES
  ('Full-Cream Milk', 'litre', 70.00),
  ('Toned Milk',      'litre', 55.00),
  ('Paneer',          'kg',    350.00),
  ('Curd',            'kg',    60.00);
