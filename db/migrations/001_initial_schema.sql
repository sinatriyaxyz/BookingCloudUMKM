-- Migration 001: Initial schema
-- Semua waktu DATETIME dalam WIB (Asia/Jakarta)

CREATE TABLE IF NOT EXISTS businesses (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_email   VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL,
  category      ENUM('barbershop','salon','bengkel','studio_foto','lainnya') NOT NULL,
  address       TEXT,
  phone         VARCHAR(30),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_businesses_owner_email (owner_email),
  UNIQUE KEY uq_businesses_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS services (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_id   INT UNSIGNED NOT NULL,
  name          VARCHAR(255) NOT NULL,
  price         INT UNSIGNED NOT NULL COMMENT 'Harga dalam rupiah',
  duration_min  INT UNSIGNED NOT NULL COMMENT 'Durasi dalam menit',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_services_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS operating_hours (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_id   INT UNSIGNED NOT NULL,
  weekday       TINYINT UNSIGNED NOT NULL COMMENT '0=Minggu, 6=Sabtu',
  open_time     TIME NOT NULL,
  close_time    TIME NOT NULL,
  is_closed     TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_operating_hours_biz_day (business_id, weekday),
  CONSTRAINT fk_operating_hours_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS holidays (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_id   INT UNSIGNED NOT NULL,
  date          DATE NOT NULL,
  note          VARCHAR(255),
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_biz_date (business_id, date),
  CONSTRAINT fk_holidays_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            CHAR(8) NOT NULL,
  business_id     INT UNSIGNED NOT NULL,
  service_id      INT UNSIGNED NOT NULL,
  customer_name   VARCHAR(255) NOT NULL,
  customer_phone  VARCHAR(30) NOT NULL,
  start_at        DATETIME NOT NULL,
  end_at          DATETIME NOT NULL,
  status          ENUM('menunggu','dikonfirmasi','selesai','dibatalkan') NOT NULL DEFAULT 'menunggu',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_code (code),
  KEY idx_bookings_biz_start (business_id, start_at),
  KEY idx_bookings_biz_status_start (business_id, status, start_at),
  CONSTRAINT fk_bookings_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

