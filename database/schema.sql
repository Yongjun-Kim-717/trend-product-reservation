CREATE DATABASE IF NOT EXISTS trend_product_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE trend_product_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS reservation_status_logs;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS inventories;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS stores;
DROP TABLE IF EXISTS location_cache;
DROP TABLE IF EXISTS unmapped_searches;
DROP TABLE IF EXISTS search_logs;
DROP TABLE IF EXISTS keyword_aliases;
DROP TABLE IF EXISTS keywords;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS admin_profiles;
DROP TABLE IF EXISTS seller_profiles;
DROP TABLE IF EXISTS consumer_profiles;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role ENUM('CONSUMER','SELLER','ADMIN') NOT NULL,
  login_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NULL,
  status ENUM('ACTIVE','PENDING','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE consumer_profiles (
  user_id BIGINT PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL,
  default_latitude DECIMAL(10, 7) NULL,
  default_longitude DECIMAL(10, 7) NULL,
  notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_consumer_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seller_profiles (
  seller_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  business_name VARCHAR(100) NOT NULL,
  business_registration_no VARCHAR(30) NOT NULL UNIQUE,
  representative_name VARCHAR(50) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_at DATETIME NULL,
  CONSTRAINT fk_seller_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_profiles (
  user_id BIGINT PRIMARY KEY,
  department VARCHAR(50) NULL,
  permission_level ENUM('READ_ONLY','OPERATOR','SUPER_ADMIN') NOT NULL DEFAULT 'OPERATOR',
  CONSTRAINT fk_admin_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_categories (
  category_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stores (
  store_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  seller_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  phone VARCHAR(30) NULL,
  opening_hours VARCHAR(100) NULL,
  approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stores_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id),
  INDEX idx_stores_seller (seller_id),
  INDEX idx_stores_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  product_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category_id BIGINT NULL,
  description TEXT NULL,
  price INT NULL,
  image_url VARCHAR(500) NULL,
  status ENUM('ACTIVE','HIDDEN','DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(category_id),
  INDEX idx_products_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventories (
  inventory_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  total_stock INT NOT NULL DEFAULT 0,
  reservable_stock INT NOT NULL DEFAULT 0,
  reserved_stock INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventories_store FOREIGN KEY (store_id) REFERENCES stores(store_id),
  CONSTRAINT fk_inventories_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT chk_inventories_total_stock CHECK (total_stock >= 0),
  CONSTRAINT chk_inventories_reservable_stock CHECK (reservable_stock >= 0),
  CONSTRAINT chk_inventories_reserved_stock CHECK (reserved_stock >= 0),
  CONSTRAINT chk_inventories_reserved_within_total CHECK (reservable_stock + reserved_stock <= total_stock),
  UNIQUE KEY uq_inventories_store_product (store_id, product_id),
  INDEX idx_inventories_product (product_id),
  INDEX idx_inventories_store_product (store_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservations (
  reservation_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  inventory_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  status ENUM('PENDING','APPROVED','CANCELED','PICKED_UP') NOT NULL DEFAULT 'PENDING',
  visit_time DATETIME NULL,
  request_note VARCHAR(255) NULL,
  canceled_at DATETIME NULL,
  picked_up_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_reservations_inventory FOREIGN KEY (inventory_id) REFERENCES inventories(inventory_id),
  CONSTRAINT chk_reservations_quantity CHECK (quantity > 0),
  INDEX idx_reservations_user (user_id),
  INDEX idx_reservations_inventory_status (inventory_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservation_status_logs (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  reservation_id BIGINT NOT NULL,
  previous_status ENUM('PENDING','APPROVED','CANCELED','PICKED_UP') NULL,
  new_status ENUM('PENDING','APPROVED','CANCELED','PICKED_UP') NOT NULL,
  changed_by_user_id BIGINT NULL,
  changed_by_role ENUM('CONSUMER','SELLER','ADMIN','SYSTEM') NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservation_status_logs_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
  CONSTRAINT fk_reservation_status_logs_user FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id),
  INDEX idx_reservation_status_logs_user (changed_by_user_id),
  INDEX idx_reservation_status_logs_reservation (reservation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE keywords (
  keyword_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  keyword_name VARCHAR(100) NOT NULL UNIQUE,
  trend_score INT NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE keyword_aliases (
  alias_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  keyword_id BIGINT NOT NULL,
  alias VARCHAR(100) NOT NULL,
  alias_normalized VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_keyword_aliases_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id),
  UNIQUE KEY uq_keyword_aliases_alias_normalized (alias_normalized),
  INDEX idx_keyword_aliases_keyword (keyword_id),
  FULLTEXT KEY ft_keyword_aliases_alias (alias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE search_logs (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  keyword_id BIGINT NULL,
  raw_query VARCHAR(255) NOT NULL,
  location_query VARCHAR(100) NULL,
  result_count INT NOT NULL DEFAULT 0,
  mapping_status ENUM('MAPPED','UNMAPPED') NOT NULL DEFAULT 'UNMAPPED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_search_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_search_logs_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id),
  INDEX idx_search_logs_user (user_id),
  INDEX idx_search_logs_keyword_created (keyword_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE unmapped_searches (
  unmapped_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  raw_query VARCHAR(255) NOT NULL,
  raw_query_normalized VARCHAR(255) NOT NULL,
  count INT NOT NULL DEFAULT 1,
  status ENUM('PENDING','RESOLVED','HOLD','REJECTED') NOT NULL DEFAULT 'PENDING',
  resolved_action VARCHAR(30) NULL,
  resolved_keyword_id BIGINT NULL,
  created_keyword_id BIGINT NULL,
  resolution_note VARCHAR(255) NULL,
  resolved_by BIGINT NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_unmapped_searches_resolved_keyword FOREIGN KEY (resolved_keyword_id) REFERENCES keywords(keyword_id),
  CONSTRAINT fk_unmapped_searches_created_keyword FOREIGN KEY (created_keyword_id) REFERENCES keywords(keyword_id),
  CONSTRAINT fk_unmapped_searches_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(user_id),
  UNIQUE KEY uq_unmapped_searches_normalized (raw_query_normalized),
  INDEX idx_unmapped_searches_resolved_keyword (resolved_keyword_id),
  INDEX idx_unmapped_searches_created_keyword (created_keyword_id),
  INDEX idx_unmapped_searches_resolved_by (resolved_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE location_cache (
  location_cache_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  query VARCHAR(100) NOT NULL,
  query_normalized VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  source ENUM('KAKAO_LOCAL','MANUAL') NOT NULL DEFAULT 'KAKAO_LOCAL',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_location_cache_query_normalized (query_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
