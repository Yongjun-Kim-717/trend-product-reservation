CREATE DATABASE IF NOT EXISTS trend_product_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE trend_product_db;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nickname VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
  store_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stores_location (latitude, longitude)
);

CREATE TABLE IF NOT EXISTS products (
  product_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS keywords (
  keyword_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  keyword_name VARCHAR(100) NOT NULL UNIQUE,
  trend_score INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS keyword_aliases (
  alias_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  keyword_id BIGINT NOT NULL,
  alias VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_keyword_aliases_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id),
  UNIQUE KEY uq_keyword_aliases_alias (alias),
  FULLTEXT KEY ft_keyword_aliases_alias (alias)
);

CREATE TABLE IF NOT EXISTS inventories (
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
  UNIQUE KEY uq_inventories_store_product (store_id, product_id)
);

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  inventory_id BIGINT NOT NULL,
  store_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_reservations_inventory FOREIGN KEY (inventory_id) REFERENCES inventories(inventory_id),
  CONSTRAINT fk_reservations_store FOREIGN KEY (store_id) REFERENCES stores(store_id),
  CONSTRAINT fk_reservations_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT chk_reservations_quantity CHECK (quantity > 0),
  INDEX idx_reservations_user (user_id),
  INDEX idx_reservations_store_product (store_id, product_id)
);

CREATE TABLE IF NOT EXISTS search_logs (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  keyword_id BIGINT NULL,
  raw_query VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_search_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_search_logs_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id),
  INDEX idx_search_logs_keyword_created (keyword_id, created_at)
);

CREATE TABLE IF NOT EXISTS unmapped_searches (
  unmapped_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  raw_query VARCHAR(255) NOT NULL UNIQUE,
  count INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
