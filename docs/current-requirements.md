# Current Requirements Specification

Last updated: 2026-05-16

## 1. Project Goal

Build a role-based platform where consumers can search trending products, find nearby stores on a Kakao Map-based interface, check reservable inventory, and reserve products. Sellers manage their stores, products, inventory, and reservations. Admins manage service-wide operational data such as users, seller/store approvals, categories, trend keywords, aliases, unmapped searches, logs, and rankings.

## 2. User Roles

### Consumer User

Consumers use the service to find and reserve products.

Required features:

- Select consumer role and log in
- Search trending products
- View nearby stores based on current location
- View stores on Kakao Map
- Check store/product inventory
- Create product reservation
- Cancel reservation
- View own reservation history

Consumer-specific data:

- Nickname
- Default location or recent location
- Notification preference

### Seller / Store Owner

Sellers manage stores, products, inventory, and reservation status.

Required features:

- Select seller role and log in
- Register and edit store information
- Register selling products
- Upload or set one representative product image
- Enter and update product inventory
- Set reservable stock
- View reservations
- Approve reservation
- Cancel reservation
- Mark pickup complete
- Reflect offline sales in inventory

Seller-specific data:

- Business name
- Business registration number
- Representative name
- Contact phone
- Approval status
- Store information

### Admin

Admins manage service-wide data and operating policies.

Required features:

- Select admin role and log in
- Manage user accounts
- Approve or reject sellers
- Approve or reject stores
- Manage product categories
- Register and manage trend keywords
- Manage KeywordAlias entries
- Review unmapped searches
- Convert unmapped searches into keyword aliases or new keywords
- Moderate inappropriate product/store data
- View search logs
- Manage trending product rankings
- View system statistics

Admin-specific data:

- Department
- Permission level
- Operation permissions

## 3. Frontend Routes Implemented

The current frontend uses route-separated role interfaces.

```text
/login
/consumer
/consumer/reservations/new
/seller
/seller/products/new
/admin
```

## 4. Product Image Policy

The project uses one representative image per product.

Recommended database approach:

```text
products.image_url
```

Do not store the binary image file directly in MariaDB. Store the uploaded file path or public URL in `products.image_url`. The actual image file should be stored later under a backend static upload directory such as:

```text
backend/uploads/products/
```

Example:

```text
products.image_url = /uploads/products/butter-rice-cake.jpg
```

## 5. Inventory Policy

Inventory must be separated into three values.

```text
total_stock
reservable_stock
reserved_stock
```

Definitions:

- `total_stock`: actual stock physically held by the store
- `reservable_stock`: stock available for online reservation
- `reserved_stock`: stock already reserved by consumers

Reservation rules:

- Reservation is allowed only when `reservable_stock >= quantity`.
- On reservation creation, decrease `reservable_stock` and increase `reserved_stock`.
- Use a transaction and row lock to prevent negative stock during concurrent reservations.

Recommended transaction flow:

```sql
START TRANSACTION;

SELECT inventory_id, reservable_stock
FROM inventories
WHERE inventory_id = ?
FOR UPDATE;

UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?;

INSERT INTO reservations (...);

COMMIT;
```

## 6. Search and Trend Keyword Policy

Raw user search text should not be treated as the final trend keyword directly.

Flow:

1. User searches raw text.
2. System attempts to match the raw query to `keyword_aliases.alias`.
3. If matched, create a `search_logs` row linked to `keywords.keyword_id`.
4. If not matched, create or update an `unmapped_searches` row.
5. Admin later reviews unmapped searches.
6. Admin can register the term as a new alias or create a new keyword.

Example:

```text
"버터떡", "버터 떡", "버터떡 맛집" -> Keyword: "버터떡"
```

## 7. Important Indexes

Recommended indexes:

```text
stores(latitude, longitude)
inventories(store_id, product_id)
reservations(user_id)
reservations(store_id, product_id)
keyword_aliases(alias) UNIQUE or FULLTEXT
search_logs(keyword_id, created_at)
unmapped_searches(raw_query) UNIQUE
```

## 8. Current Frontend Data Expectations

The frontend mock data currently assumes these fields exist or will exist through API responses.

Product:

```json
{
  "product_id": 1,
  "name": "버터떡",
  "category": "디저트",
  "description": "상품 설명",
  "image_url": "/uploads/products/example.jpg",
  "trend_badge": "추천"
}
```

Store:

```json
{
  "store_id": 1,
  "seller_id": 1,
  "name": "성수 디저트랩",
  "address": "서울 성동구 성수이로 10",
  "latitude": 37.544581,
  "longitude": 127.055961,
  "opening_hours": "10:00 - 21:00",
  "approval_status": "APPROVED"
}
```

Inventory:

```json
{
  "inventory_id": 1,
  "store_id": 1,
  "product_id": 1,
  "total_stock": 40,
  "reservable_stock": 18,
  "reserved_stock": 6
}
```

Reservation:

```json
{
  "reservation_id": 1,
  "user_id": 1,
  "inventory_id": 1,
  "quantity": 2,
  "status": "PENDING",
  "visit_time": "2026-05-16T16:30:00"
}
```
