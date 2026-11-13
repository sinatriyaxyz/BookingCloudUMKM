-- Migration 004: Sistem poin loyalitas, katalog voucher potongan harga, dan dukungan analitik

ALTER TABLE customers
  ADD COLUMN points INT UNSIGNED NOT NULL DEFAULT 0 AFTER phone;

CREATE TABLE IF NOT EXISTS vouchers (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_prefix     VARCHAR(20) NOT NULL,
  title           VARCHAR(120) NOT NULL,
  description     VARCHAR(255) NOT NULL,
  discount_type   ENUM('fixed', 'percent') NOT NULL,
  discount_value  INT UNSIGNED NOT NULL COMMENT 'Rupiah atau persen (1-100)',
  max_discount    INT UNSIGNED NULL COMMENT 'Batas maks rupiah untuk tipe percent',
  min_spend       INT UNSIGNED NOT NULL DEFAULT 0,
  points_cost     INT UNSIGNED NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vouchers_prefix (code_prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO vouchers
  (code_prefix, title, description, discount_type, discount_value, max_discount, min_spend, points_cost, is_active)
VALUES
  ('HEMAT5K', 'Potongan Rp 5.000', 'Potongan langsung Rp 5.000 untuk semua layanan UMKM (min. Rp 20.000).', 'fixed', 5000, NULL, 20000, 50, 1),
  ('DISKON10K', 'Potongan Rp 10.000', 'Hemat Rp 10.000 untuk reservasi minimal Rp 35.000.', 'fixed', 10000, NULL, 35000, 90, 1),
  ('HEMAT15PCT', 'Diskon 15%', 'Diskon 15% hingga Rp 25.000 untuk transaksi minimal Rp 40.000.', 'percent', 15, 25000, 40000, 120, 1),
  ('HEMAT25K', 'Potongan Rp 25.000', 'Potongan spesial Rp 25.000 untuk reservasi minimal Rp 75.000.', 'fixed', 25000, NULL, 75000, 200, 1),
  ('VIP30PCT', 'Diskon VIP 30%', 'Diskon 30% hingga Rp 50.000 untuk member loyal (min. Rp 100.000).', 'percent', 30, 50000, 100000, 300, 1);

CREATE TABLE IF NOT EXISTS customer_vouchers (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   INT UNSIGNED NOT NULL,
  voucher_id    INT UNSIGNED NOT NULL,
  code          VARCHAR(24) NOT NULL,
  status        ENUM('tersedia', 'terpakai') NOT NULL DEFAULT 'tersedia',
  redeemed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at       DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_vouchers_code (code),
  KEY idx_customer_vouchers_cust_status (customer_id, status),
  CONSTRAINT fk_cv_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cv_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE bookings
  ADD COLUMN original_price INT UNSIGNED NOT NULL DEFAULT 0 AFTER end_at,
  ADD COLUMN discount_amount INT UNSIGNED NOT NULL DEFAULT 0 AFTER original_price,
  ADD COLUMN final_price INT UNSIGNED NOT NULL DEFAULT 0 AFTER discount_amount,
  ADD COLUMN customer_voucher_id INT UNSIGNED NULL AFTER final_price,
  ADD COLUMN points_earned INT UNSIGNED NOT NULL DEFAULT 0 AFTER customer_voucher_id,
  ADD CONSTRAINT fk_bookings_cv FOREIGN KEY (customer_voucher_id) REFERENCES customer_vouchers(id) ON DELETE SET NULL;

UPDATE bookings b
JOIN services s ON b.service_id = s.id
SET b.original_price = s.price,
    b.final_price = s.price
WHERE b.original_price = 0;

CREATE TABLE IF NOT EXISTS point_transactions (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   INT UNSIGNED NOT NULL,
  booking_id    INT UNSIGNED NULL,
  voucher_id    INT UNSIGNED NULL,
  type          ENUM('earn', 'redeem') NOT NULL,
  points        INT NOT NULL COMMENT 'Positif untuk earn, negatif untuk redeem',
  description   VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pt_earn_booking (booking_id, type),
  KEY idx_pt_customer (customer_id, created_at),
  CONSTRAINT fk_pt_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_pt_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

