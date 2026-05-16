# MariaDB Development Guide

Last updated: 2026-05-16

This guide is for the database teammate. It explains the recommended implementation order and compatibility points for the current frontend.

## 1. Development Goal

Design a MariaDB schema that supports three user roles:

- Consumer User
- Seller / Store Owner
- Admin

The frontend is already separated by role, so the database should also separate common user data from role-specific profile data.

## 2. Recommended Implementation Order

### Step 1. Update User Model

Use one common users table and separate profile tables.

Recommended tables:

```text
users
consumer_profiles
seller_profiles
admin_profiles
```

Reason:

- Login/status/role are common.
- Consumer location and notification data are consumer-only.
- Seller business and approval data are seller-only.
- Admin permission data is admin-only.

Suggested columns:

```sql
users (
  user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role ENUM('CONSUMER', 'SELLER', 'ADMIN') NOT NULL,
  login_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(30),
  status ENUM('ACTIVE', 'PENDING', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
consumer_profiles (
  user_id BIGINT PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL,
  default_latitude DECIMAL(10, 7),
  default_longitude DECIMAL(10, 7),
  notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

```sql
seller_profiles (
  seller_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  business_name VARCHAR(100) NOT NULL,
  business_registration_no VARCHAR(30) NOT NULL UNIQUE,
  representative_name VARCHAR(50) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  approval_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

```sql
admin_profiles (
  user_id BIGINT PRIMARY KEY,
  department VARCHAR(50),
  permission_level ENUM('READ_ONLY', 'OPERATOR', 'SUPER_ADMIN') NOT NULL DEFAULT 'OPERATOR',
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### Step 2. Connect Stores to Sellers

Stores should be owned by sellers.

```sql
stores (
  store_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  seller_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  phone VARCHAR(30),
  opening_hours VARCHAR(100),
  approval_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id),
  INDEX idx_stores_location (latitude, longitude)
);
```

### Step 3. Update Products for Single Representative Image

Use one representative image URL per product.

```sql
products (
  product_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category_id BIGINT NULL,
  description TEXT,
  price INT NULL,
  image_url VARCHAR(500),
  status ENUM('ACTIVE', 'HIDDEN', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

If categories are required:

```sql
product_categories (
  category_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);
```

### Step 4. Keep Inventory as Store-Product Relationship

Inventory connects stores and products.

```sql
inventories (
  inventory_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  store_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  total_stock INT NOT NULL DEFAULT 0,
  reservable_stock INT NOT NULL DEFAULT 0,
  reserved_stock INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(store_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  UNIQUE KEY uq_inventories_store_product (store_id, product_id),
  INDEX idx_inventories_store_product (store_id, product_id),
  CHECK (total_stock >= 0),
  CHECK (reservable_stock >= 0),
  CHECK (reserved_stock >= 0)
);
```

Important validation rule:

```text
reservable_stock + reserved_stock <= total_stock
```

This can be checked in backend code even if MariaDB CHECK behavior differs by version.

### Step 5. Implement Reservations by Inventory ID

Reservations should reference `inventory_id` because reservation targets a specific store-product inventory row.

```sql
reservations (
  reservation_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  inventory_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'CANCELED', 'PICKED_UP') NOT NULL DEFAULT 'PENDING',
  visit_time DATETIME NULL,
  request_note VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (inventory_id) REFERENCES inventories(inventory_id),
  INDEX idx_reservations_user (user_id),
  INDEX idx_reservations_inventory_status (inventory_id, status),
  CHECK (quantity > 0)
);
```

Status meaning:

```text
PENDING: consumer requested reservation
APPROVED: seller approved reservation
CANCELED: reservation canceled by user or seller
PICKED_UP: consumer picked up item at store
```

### Step 6. Implement Keyword and Search Tables

Recommended tables:

```text
keywords
keyword_aliases
search_logs
unmapped_searches
```

Keep the existing idea:

- Raw searches are stored in search logs.
- If query maps to alias, connect to keyword.
- If not mapped, store or increment in unmapped searches.

### Step 7. Add Admin/Audit Tables if Time Allows

Optional but useful for presentation:

```sql
audit_logs (
  audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_user_id BIGINT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id BIGINT NULL,
  description VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(user_id)
);
```

## 3. API Compatibility Targets

The frontend is currently mock-based, but these API shapes should be supported later.

### Consumer

```text
GET /api/products/trending
GET /api/products/search?query=버터떡
GET /api/stores/nearby?lat=37.5&lng=127.0&productId=1
GET /api/stores/:storeId/inventories
POST /api/reservations
GET /api/users/:userId/reservations
PATCH /api/reservations/:reservationId/cancel
```

### Seller

```text
GET /api/seller/stores
PATCH /api/seller/stores/:storeId
POST /api/seller/products
GET /api/seller/stores/:storeId/products
PATCH /api/seller/inventories/:inventoryId
GET /api/seller/reservations
PATCH /api/seller/reservations/:reservationId/status
```

### Admin

```text
GET /api/admin/users
GET /api/admin/sellers/pending
PATCH /api/admin/sellers/:sellerId/approval
GET /api/admin/stores/pending
PATCH /api/admin/stores/:storeId/approval
GET /api/admin/keywords
POST /api/admin/keywords
POST /api/admin/keyword-aliases
GET /api/admin/unmapped-searches
PATCH /api/admin/unmapped-searches/:id/resolve
GET /api/admin/search-logs
```

## 4. Data Seed Policy

Current `database/seed.sql` has been intentionally emptied. Add sample data only after the schema is updated and agreed by the team.

When adding sample data, include at least:

```text
1 consumer user
1 seller user
1 admin user
1 approved seller profile
2 approved stores
3 products with image_url placeholders
5 inventory rows
3 keywords
5 keyword aliases
3 search logs
2 unmapped searches
```

Do not insert sample data that violates role relationships.

## 5. Coordination Checklist

Before pushing database changes, verify:

- `schema.sql` runs from an empty MariaDB database.
- `seed.sql` runs after `schema.sql` without FK errors.
- stores have valid `latitude` and `longitude`.
- products have `image_url` column, even if the value is NULL.
- inventories use `inventory_id` as reservation target.
- reservations do not directly decrease stock without a transaction in backend logic.
- keyword aliases are unique.
- unmapped searches use unique `raw_query` and increment `count`.

## 6. Suggested Branch

Recommended branch name for the DB teammate:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/database-role-schema
```

Recommended commit messages:

```text
feat: update role-based database schema
feat: add database seed data
feat: add inventory reservation constraints
```
