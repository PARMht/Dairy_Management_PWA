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

-- ============================================================
-- 6. Idempotency_Keys  (dedup for offline-sync bulk inserts)
--    Previously created at runtime in logController.js — now
--    properly declared here in the DDL.
-- ============================================================
CREATE TABLE IF NOT EXISTS Idempotency_Keys (
  sync_id       VARCHAR(255)  PRIMARY KEY,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- Performance indexes for billing & payment queries
-- ============================================================
CREATE INDEX idx_daily_logs_customer_date
  ON Daily_Logs (customer_id, log_date);

CREATE INDEX idx_payments_customer_date
  ON Payments (customer_id, payment_date);

-- ============================================================
-- View: v_customer_balance
-- Computes each customer's total billed, total paid, and
-- pending amount.  This powers the diary-style payment ledger.
--
-- Usage:  SELECT * FROM v_customer_balance
--         WHERE customer_id = ?;
-- ============================================================
CREATE OR REPLACE VIEW v_customer_balance AS
SELECT
  c.id              AS customer_id,
  c.name            AS customer_name,
  c.phone,
  COALESCE(dl.total_billed, 0)  AS total_billed,
  COALESCE(p.total_paid,   0)   AS total_paid,
  COALESCE(dl.total_billed, 0)
    - COALESCE(p.total_paid, 0) AS pending_amount
FROM Customers c
LEFT JOIN (
  SELECT customer_id, SUM(total_charge) AS total_billed
  FROM Daily_Logs
  GROUP BY customer_id
) dl ON dl.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount) AS total_paid
  FROM Payments
  GROUP BY customer_id
) p ON p.customer_id = c.id
WHERE c.is_active = TRUE;

-- ============================================================
-- View: v_monthly_bill
-- Aggregates Daily_Logs per customer per month, joins with
-- Payments for the same period, and computes pending amounts.
--
-- Usage:  SELECT * FROM v_monthly_bill
--         WHERE bill_month = '2026-06';
-- ============================================================
CREATE OR REPLACE VIEW v_monthly_bill AS
SELECT
  c.id                                    AS customer_id,
  c.name                                  AS customer_name,
  c.phone,
  DATE_FORMAT(dl.log_date, '%Y-%m')       AS bill_month,
  COUNT(dl.id)                            AS delivery_count,
  SUM(dl.total_charge)                    AS total_billed,
  COALESCE(p.total_paid, 0)              AS total_paid,
  SUM(dl.total_charge)
    - COALESCE(p.total_paid, 0)           AS pending_amount
FROM Daily_Logs dl
JOIN Customers c ON dl.customer_id = c.id
LEFT JOIN (
  SELECT
    customer_id,
    DATE_FORMAT(payment_date, '%Y-%m')    AS pay_month,
    SUM(amount)                           AS total_paid
  FROM Payments
  GROUP BY customer_id, DATE_FORMAT(payment_date, '%Y-%m')
) p ON p.customer_id = c.id
     AND p.pay_month = DATE_FORMAT(dl.log_date, '%Y-%m')
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.phone,
         DATE_FORMAT(dl.log_date, '%Y-%m'),
         p.total_paid;
