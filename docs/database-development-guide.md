# MariaDB 개발 가이드

최종 수정일: 2026-05-16

이 문서는 데이터베이스 담당 팀원이 현재 프론트엔드 구조와 호환되도록 MariaDB 스키마를 개발하기 위한 가이드이다.

## 1. 개발 목표

데이터베이스는 다음 3가지 사용자 역할을 지원해야 한다.

```text
소비자 User
판매자 Store Owner / Seller
관리자 Admin
```

현재 프론트엔드는 역할별 화면이 분리되어 있으므로, 데이터베이스도 공통 사용자 정보와 역할별 추가 정보를 분리해서 설계하는 것을 권장한다.

## 2. 전체 개발 순서

권장 개발 순서:

```text
1. users 및 역할별 profile 테이블 설계
2. seller_profiles와 stores 연결
3. product_categories 및 products 설계
4. products.image_url 컬럼 추가
5. inventories로 매장-상품 재고 관계 설계
6. reservations를 inventory_id 기준으로 설계
7. keywords, keyword_aliases, search_logs, unmapped_searches 설계
8. 관리자 승인/감사 로그 테이블은 시간이 남으면 추가
9. schema.sql 실행 검증
10. seed.sql 샘플 데이터 작성
```

## 3. 사용자 테이블 설계

공통 사용자 정보는 `users` 테이블에서 관리하고, 역할별 정보는 별도 profile 테이블에서 관리한다.

권장 테이블:

```text
users
consumer_profiles
seller_profiles
admin_profiles
```

이렇게 분리하는 이유:

- 로그인, 상태, 역할은 모든 사용자에게 공통이다.
- 소비자는 위치 기반 탐색 정보가 중요하다.
- 판매자는 사업자 정보와 승인 상태가 중요하다.
- 관리자는 권한 정보가 중요하다.

### 3.1 users

```sql
CREATE TABLE users (
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

### 3.2 consumer_profiles

```sql
CREATE TABLE consumer_profiles (
  user_id BIGINT PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL,
  default_latitude DECIMAL(10, 7),
  default_longitude DECIMAL(10, 7),
  notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### 3.3 seller_profiles

```sql
CREATE TABLE seller_profiles (
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

### 3.4 admin_profiles

```sql
CREATE TABLE admin_profiles (
  user_id BIGINT PRIMARY KEY,
  department VARCHAR(50),
  permission_level ENUM('READ_ONLY', 'OPERATOR', 'SUPER_ADMIN') NOT NULL DEFAULT 'OPERATOR',
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

## 4. 판매자와 매장 연결

매장은 판매자가 관리하므로 `stores`는 `seller_profiles`와 연결한다.

```sql
CREATE TABLE stores (
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

설계 포인트:

- 한 판매자는 여러 매장을 가질 수 있다.
- 관리자는 판매자와 매장을 승인 또는 반려할 수 있다.
- 위치 기반 검색을 위해 `latitude`, `longitude` 인덱스를 둔다.

## 5. 상품 및 대표 이미지 설계

상품 이미지는 단일 대표 이미지만 사용한다.

DB에는 이미지 파일 자체를 저장하지 않고 이미지 URL 또는 서버 파일 경로만 저장한다.

권장 구조:

```sql
CREATE TABLE product_categories (
  category_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);
```

```sql
CREATE TABLE products (
  product_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category_id BIGINT NULL,
  description TEXT,
  price INT NULL,
  image_url VARCHAR(500),
  status ENUM('ACTIVE', 'HIDDEN', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(category_id)
);
```

예시:

```text
image_url = /uploads/products/butter-rice-cake.jpg
```

## 6. 재고 테이블 설계

`inventories`는 매장과 상품의 관계를 나타낸다.

즉, 한 상품은 여러 매장에서 판매될 수 있고, 한 매장은 여러 상품을 판매할 수 있다.

```sql
CREATE TABLE inventories (
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

중요 검증 규칙:

```text
reservable_stock + reserved_stock <= total_stock
```

MariaDB 버전에 따라 CHECK 제약 동작이 다를 수 있으므로, 백엔드에서도 반드시 검증하는 것을 권장한다.

## 7. 예약 테이블 설계

예약은 특정 매장의 특정 상품 재고를 대상으로 하므로 `inventory_id`를 기준으로 연결한다.

```sql
CREATE TABLE reservations (
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

예약 상태 의미:

```text
PENDING
- 소비자가 예약을 요청한 상태

APPROVED
- 판매자가 예약을 승인한 상태

CANCELED
- 소비자 또는 판매자가 예약을 취소한 상태

PICKED_UP
- 소비자가 매장에서 상품을 수령 완료한 상태
```

예약 생성 시 재고 처리:

```sql
START TRANSACTION;

SELECT inventory_id, reservable_stock
FROM inventories
WHERE inventory_id = ?
FOR UPDATE;

-- reservable_stock >= quantity 확인

UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?;

INSERT INTO reservations (user_id, inventory_id, quantity, status, visit_time, request_note)
VALUES (?, ?, ?, 'PENDING', ?, ?);

COMMIT;
```

## 8. 키워드 및 검색 로그 설계

검색어는 그대로 기준 키워드가 되지 않고, `keyword_aliases`를 통해 기준 키워드인 `keywords`로 매핑된다.

권장 테이블:

```sql
CREATE TABLE keywords (
  keyword_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  keyword_name VARCHAR(100) NOT NULL UNIQUE,
  trend_score INT NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE keyword_aliases (
  alias_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  keyword_id BIGINT NOT NULL,
  alias VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id),
  UNIQUE KEY uq_keyword_aliases_alias (alias),
  FULLTEXT KEY ft_keyword_aliases_alias (alias)
);
```

```sql
CREATE TABLE search_logs (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  keyword_id BIGINT NULL,
  raw_query VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id),
  INDEX idx_search_logs_keyword_created (keyword_id, created_at)
);
```

```sql
CREATE TABLE unmapped_searches (
  unmapped_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  raw_query VARCHAR(255) NOT NULL UNIQUE,
  count INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

처리 흐름:

```text
1. 사용자가 검색한다.
2. keyword_aliases.alias와 매칭한다.
3. 매칭 성공 시 search_logs.keyword_id에 기준 키워드를 연결한다.
4. 매칭 실패 시 unmapped_searches에 저장하거나 count를 증가시킨다.
5. 관리자가 미매핑 검색어를 검토한다.
6. 기존 키워드 별칭으로 등록하거나 신규 키워드로 생성한다.
```

## 9. 관리자 감사 로그 선택 사항

시간이 남으면 관리자 처리 이력을 남기는 `audit_logs`를 추가할 수 있다.

```sql
CREATE TABLE audit_logs (
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

예시 action:

```text
SELLER_APPROVED
STORE_REJECTED
KEYWORD_ALIAS_CREATED
UNMAPPED_SEARCH_RESOLVED
PRODUCT_HIDDEN
```

## 10. 프론트엔드와 맞출 API 목표

현재 프론트엔드는 mock 데이터를 사용하지만, 이후 아래 API와 연결될 예정이다.

### 소비자 API

```text
GET /api/products/trending
GET /api/products/search?query=버터떡
GET /api/stores/nearby?lat=37.5&lng=127.0&productId=1
GET /api/stores/:storeId/inventories
POST /api/reservations
GET /api/users/:userId/reservations
PATCH /api/reservations/:reservationId/cancel
```

### 판매자 API

```text
GET /api/seller/stores
PATCH /api/seller/stores/:storeId
POST /api/seller/products
GET /api/seller/stores/:storeId/products
PATCH /api/seller/inventories/:inventoryId
GET /api/seller/reservations
PATCH /api/seller/reservations/:reservationId/status
```

### 관리자 API

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

## 11. seed.sql 작성 기준

현재 `database/seed.sql`은 일부러 비워둔 상태이다.

역할 기반 스키마가 확정된 뒤 샘플 데이터를 작성한다.

최소 샘플 데이터 추천:

```text
소비자 계정 1개
판매자 계정 1개
관리자 계정 1개
승인된 판매자 프로필 1개
승인된 매장 2개
상품 3개
상품별 image_url 예시
재고 데이터 5개 이상
기준 키워드 3개
키워드 별칭 5개 이상
검색 로그 3개 이상
미매핑 검색어 2개 이상
```

주의사항:

- 외래키 순서에 맞게 INSERT한다.
- users를 먼저 넣고 profile 테이블을 넣는다.
- seller_profiles를 넣은 뒤 stores를 넣는다.
- product_categories를 넣은 뒤 products를 넣는다.
- stores와 products를 넣은 뒤 inventories를 넣는다.
- inventories를 넣은 뒤 reservations를 넣는다.

## 12. DB 담당자 작업 브랜치 추천

```bash
git checkout develop
git pull origin develop
git checkout -b feature/database-role-schema
```

추천 커밋 메시지:

```text
feat: update role-based database schema
feat: add database seed data
feat: add inventory reservation constraints
```

## 13. 제출 전 확인 사항

DB 변경사항을 push하기 전에 확인할 것:

```text
schema.sql이 빈 MariaDB 데이터베이스에서 정상 실행되는가?
seed.sql이 schema.sql 실행 후 외래키 오류 없이 실행되는가?
stores에 latitude, longitude가 있는가?
products에 image_url 컬럼이 있는가?
inventories가 store_id, product_id를 기준으로 유일한가?
reservations가 inventory_id를 참조하는가?
예약 시 재고 음수 방지 로직을 백엔드에서 구현할 수 있는가?
keyword_aliases.alias가 중복되지 않는가?
unmapped_searches.raw_query가 중복되지 않고 count 증가가 가능한가?
```
