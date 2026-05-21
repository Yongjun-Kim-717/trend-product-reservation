# API 명세서

Base URL: `http://localhost:4000/api`

최종 수정일: 2026-05-20

## 1. 공통 규칙

### 응답 형식

성공 응답은 기본적으로 JSON을 반환한다.

```json
{
  "data": {},
  "message": "success"
}
```

목록 조회 응답은 배열 또는 페이지 정보를 포함할 수 있다.

```json
{
  "data": [],
  "meta": {
    "total": 10
  }
}
```

에러 응답:

```json
{
  "message": "에러 메시지",
  "code": "ERROR_CODE"
}
```

### 상태 코드

```text
200 OK: 조회/수정 성공
201 Created: 생성 성공
400 Bad Request: 요청 값 오류
401 Unauthorized: 인증 필요
403 Forbidden: 권한 없음
404 Not Found: 리소스 없음
409 Conflict: 재고 부족 등 비즈니스 충돌
500 Internal Server Error: 서버 오류
```

## 2. Health

### GET /health

서버와 DB 연결 상태를 확인한다.

Response:

```json
{
  "status": "ok",
  "db": true
}
```

## 3. 인증 API

현재 프로토타입은 프론트엔드 `localStorage`에 `currentUser`를 저장하고, 소비자/판매자 화면에서 해당 사용자의 `user_id`를 API에 전달한다. 운영 수준의 JWT/세션 인증은 추후 전환 대상으로 둔다.

주의: 현재 seed 데이터의 `password_hash`는 실제 해시가 아니라 `pw_1` 같은 시연용 문자열이다. 발표 프로토타입에서는 같은 방식으로 비교하지만, 최종 운영 구조에서는 bcrypt/argon2 해시와 서버 세션 또는 JWT로 교체해야 한다.

### POST /auth/login

Request:

```json
{
  "login_id": "consumer1",
  "password": "pw_1"
}
```

Response:

```json
{
  "data": {
    "user": {
      "user_id": 2,
      "role": "CONSUMER",
      "login_id": "consumer1",
      "name": "강태민",
      "phone": "010-0000-0001",
      "status": "ACTIVE"
    },
    "session": {
      "token": "demo-2-..."
    }
  },
  "message": "success"
}
```

시연 계정:

```text
소비자: consumer1 / pw_1
판매자: seller1 / pw_6
관리자: admin1 / pw_11
```

### POST /auth/register

소비자와 판매자 계정만 생성한다. 관리자는 DB seed 또는 관리자 화면에서 별도 관리한다.

Request:

```json
{
  "role": "SELLER",
  "login_id": "seller_new",
  "password": "pw_100",
  "name": "신규 판매자",
  "phone": "010-0000-0100"
}
```

Response: `/auth/login`과 동일한 `user`, `session` 구조를 반환한다.

## 4. 통합 검색 API

### GET /search?query=부평역%20주변%20버터떡&lat=37.4904&lng=126.7248&radiusKm=5

소비자 메인 화면의 핵심 검색 API이다.

사용자가 입력한 검색어에서 위치 의도와 상품 의도를 분리하고, 위치 기준 주변 매장과 상품 재고를 반환한다.

예시 검색어:

```text
부평역 주변 버터떡
성수역 두쫀쿠
홍대입구역 근처 약과쿠키
강남역 버터떡
```

백엔드 처리 흐름:

```text
1. raw query 수신
2. 위치 후보 추출
3. 상품 키워드 후보 추출
4. location_cache 조회
5. 캐시에 없으면 Kakao Local REST API 호출
6. 위치 좌표 저장 또는 재사용
7. 상품 키워드를 keyword_aliases.alias_normalized로 매핑
8. 상품 키워드 매핑이 없으면 product_categories 기준 카테고리어도 매핑한다.
9. 매핑 성공 시 keyword_id/product/category 기준 상품 조회
10. 매핑 실패 시 unmapped_searches 저장 또는 count 증가
11. 기준 좌표 주변 매장 후보 조회
12. inventories와 products 조인
13. 거리 계산 및 거리순 정렬
13. search_logs 저장
14. 프론트에 검색 기준 위치, 키워드, 매장 목록 반환
```

Query Parameters:

```text
query: 사용자 검색어, 필수
lat: 사용자 현재 기준 위치 위도, 선택값
lng: 사용자 현재 기준 위치 경도, 선택값
radiusKm: 검색 반경 km, 선택값, 기본 5
```

위치 기준 결정 우선순위:

```text
1. location_cache에 이미 저장된 위치어가 query에 포함되어 있으면 해당 좌표 사용
2. "부평역 주변", "송도 근처", "인하대학교 후문 맛집"처럼 장소 검색 의도가 있으면 Kakao Local REST API로 좌표 조회
3. 상품명만 검색한 경우 lat/lng 파라미터를 기준 위치로 사용
4. 위치를 찾지 못하고 lat/lng도 없으면 location은 null이며 매장 목록은 반환하지 않는다
```

중요 정책:

```text
- 장소 좌표는 백엔드에서만 Kakao Local REST API로 조회한다.
- 조회된 좌표는 location_cache에 저장해 다음 검색부터 API 호출을 줄인다.
- 위치를 확정할 수 없는 검색어는 전체 매장을 반환하지 않는다.
- 반경 안 매장이 없으면 location은 반환하고 stores는 빈 배열로 반환한다.
- 프론트는 location을 기준으로 지도를 이동시키고, stores가 비어 있으면 "주변 매장 없음" 상태를 표시한다.
```

위치어가 포함되지 않은 검색어 예시:

```text
버터떡
두쫀쿠
약과쿠키
```

Response:

```json
{
  "data": {
    "location": {
      "query": "부평역",
      "latitude": 37.4895,
      "longitude": 126.7247,
      "source": "KAKAO_LOCAL"
    },
    "keyword": {
      "raw": "버터떡",
      "keyword_id": 1,
      "keyword_name": "버터떡",
      "mapped": true
    },
    "product": {
      "product_id": null,
      "name": null,
      "raw": null,
      "mapped": false
    },
    "radius_km": 5,
    "stores": [
      {
        "store_id": 1,
        "name": "성수 디저트랩",
        "address": "서울 성동구 성수이로 10",
        "latitude": 37.544581,
        "longitude": 127.055961,
        "distance_km": 28.4,
        "inventory": {
          "inventory_id": 1,
          "product_id": 1,
          "product_name": "버터떡",
          "image_url": "/uploads/products/butter-rice-cake.jpg",
          "total_stock": 40,
          "reservable_stock": 18,
          "reserved_stock": 6
        }
      }
    ]
  }
}
```

성능 고려사항:

```text
- Kakao Local REST API 결과는 location_cache에 저장한다.
- location_cache.query_normalized에는 UNIQUE 인덱스를 둔다.
- keyword_aliases.alias_normalized에는 UNIQUE 또는 INDEX를 둔다.
- unmapped_searches.raw_query_normalized에는 UNIQUE 인덱스를 둔다.
- 위치 기반 매장 검색은 stores(latitude, longitude) 인덱스를 활용한다.
- 검색어 매핑은 LIKE '%검색어%' 방식보다 정규화된 alias exact match를 우선한다.
- 검색 로그 저장은 초기에는 동기 INSERT로 처리해도 된다.
```

## 4. Product API

### GET /products

상품 목록을 조회한다.

### GET /product-categories

상품 등록 화면에서 사용할 활성 카테고리 목록을 조회한다. 카테고리는 판매자가 임의로 새로 만드는 값이 아니라 관리자 또는 DB가 관리하는 기준 데이터로 본다.

Response:

```json
{
  "data": [
    {
      "category_id": 1,
      "name": "디저트",
      "status": "ACTIVE"
    }
  ],
  "message": "success"
}
```

Response:

```json
{
  "data": [
    {
      "product_id": 1,
      "name": "버터떡",
      "category": "디저트",
      "description": "상품 설명",
      "price": 3500,
      "image_url": "/uploads/products/butter-rice-cake.jpg",
      "status": "ACTIVE"
    }
  ]
}
```

### GET /keywords/trending

최근 인기 검색어를 Keyword 기준으로 조회한다. 이 API는 특정 매장의 실제 판매 상품이 아니라, 사용자가 검색한 유행 대상의 기준 키워드 랭킹을 반환한다.

랭킹 산정 정책:

```text
1. 최근 7일 search_logs 중 keyword_id가 있는 MAPPED 검색을 집계한다.
2. keyword_id별 검색 수를 COUNT한다.
3. 검색 수 DESC, 최근 검색 시각 DESC 순으로 정렬한다.
4. 최근 검색 로그가 없으면 keywords.trend_score 기준 관리자 추천 순위로 fallback한다.
```

Response:

```json
{
  "data": [
    {
      "rank": 1,
      "keyword_id": 1,
      "keyword_name": "버터떡",
      "search_count": 12,
      "rank_basis": "SEARCH_LOG_7D"
    }
  ]
}
```

호환 API:

```text
GET /products/trending
```

기존 프론트 호환을 위해 같은 응답을 반환한다. 단, 의미상 신규 구현에서는 `/keywords/trending` 사용을 권장한다.

## 5. Store API

### GET /stores/nearby?lat=37.4895&lng=126.7247&productId=1&radiusKm=5

좌표와 상품 기준으로 주변 매장을 조회한다.

Query Parameters:

```text
lat: 기준 위도
lng: 기준 경도
productId: 선택 상품 ID, 선택값
radiusKm: 검색 반경 km, 선택값, 기본 5
```

Response:

```json
{
  "data": [
    {
      "store_id": 1,
      "name": "성수 디저트랩",
      "address": "서울 성동구 성수이로 10",
      "latitude": 37.544581,
      "longitude": 127.055961,
      "distance_km": 0.08,
      "inventory": {
        "inventory_id": 1,
        "product_id": 1,
        "product_name": "버터떡",
        "image_url": "/uploads/products/butter-rice-cake.jpg",
        "total_stock": 40,
        "reservable_stock": 18,
        "reserved_stock": 6
      }
    }
  ]
}
```

### GET /stores/:storeId

매장 상세 정보를 조회한다.

### GET /stores/:storeId/inventories

특정 매장의 상품별 재고를 조회한다.

Response:

```json
{
  "data": [
    {
      "inventory_id": 1,
      "store_id": 1,
      "product_id": 1,
      "product_name": "버터떡",
      "total_stock": 40,
      "reservable_stock": 18,
      "reserved_stock": 6
    }
  ]
}
```

## 6. Seller API

현재 구현에서는 로그인 후 프론트엔드가 `currentUser.user_id`를 읽어 `sellerId` 또는 `seller_id`로 전달한다. 백엔드는 이 사용자 ID로 `seller_profiles.seller_id`를 조회한 뒤, 해당 판매자 프로필이 소유한 매장/재고/예약만 조회하거나 수정한다. 추후 JWT 인증으로 전환하면 query/body의 판매자 ID 대신 토큰의 사용자 ID를 기준으로 권한을 판정한다.

### GET /seller/stores?sellerId=2

판매자가 소유한 매장 목록을 조회한다.

### POST /seller/stores

판매자가 새 매장을 등록한다. 판매자 한 명은 여러 매장을 등록할 수 있으며, 새 매장은 기본적으로 `PENDING` 상태로 저장된다. 주소 좌표는 백엔드에서 Kakao Local REST API로 조회하여 `stores.latitude`, `stores.longitude`에 저장한다.

Request:

```json
{
  "seller_id": 5,
  "name": "부평 버터떡 팝업스토어",
  "address": "인천 부평구 부평대로 1",
  "phone": "032-000-0000",
  "opening_hours": "10:00-20:00"
}
```

Response:

```json
{
  "data": {
    "store_id": 6,
    "seller_id": 1,
    "name": "부평 버터떡 팝업스토어",
    "address": "인천 부평구 부평대로 1",
    "latitude": 37.4904,
    "longitude": 126.7248,
    "phone": "032-000-0000",
    "opening_hours": "10:00-20:00",
    "approval_status": "PENDING"
  },
  "message": "success"
}
```

### PATCH /seller/stores/:storeId

판매자가 본인 소유 매장 정보를 수정한다. 매장명 또는 주소가 바뀌면 좌표를 다시 조회해 저장한다.

Request:

```json
{
  "seller_id": 5,
  "name": "부평 버터떡 팝업스토어",
  "address": "인천 부평구 부평대로 10",
  "phone": "032-000-0001",
  "opening_hours": "11:00-21:00"
}
```

### GET /seller/stores/:storeId/inventories?sellerId=2

판매자 매장의 상품별 재고를 조회한다.

### POST /seller/stores/:storeId/products

판매자가 선택한 매장에 상품을 등록한다. 이 API는 `products`와 `inventories`를 같은 트랜잭션에서 생성한다.

Request:

```json
{
  "seller_id": 5,
  "name": "버터떡",
  "category_id": 1,
  "description": "버터 풍미가 강한 떡",
  "price": 3500,
  "image_url": "/uploads/products/butter-rice-cake.png",
  "total_stock": 100,
  "reservable_stock": 60
}
```

처리 흐름:

```text
1. currentUser.user_id로 seller_profiles.seller_id를 조회한다.
2. storeId가 해당 판매자 프로필 소유 매장인지 확인한다.
3. 같은 매장에 동일 상품명이 이미 등록되어 있으면 409를 반환한다.
4. product_categories에서 활성 카테고리인지 확인한다.
5. products에 상품 정보를 생성한다.
6. inventories에 store_id + product_id + 재고 정보를 생성한다. 이때 reserved_stock은 0으로 시작한다.
7. 모든 작업은 같은 트랜잭션에서 처리한다.
```

Response:

```json
{
  "data": {
    "inventory_id": 13,
    "store_id": 7,
    "product_id": 8,
    "product_name": "버터떡",
    "category_name": "디저트",
    "price": 3500,
    "image_url": "/uploads/products/butter-rice-cake.png",
    "total_stock": 100,
    "reservable_stock": 60,
    "reserved_stock": 0
  },
  "message": "success"
}
```

### PATCH /seller/inventories/:inventoryId

판매자가 상품 재고를 수정한다. 프론트엔드는 숫자 입력 변경만으로 저장하지 않고, `수정 확인` 버튼을 눌렀을 때만 이 API를 호출한다. `reserved_stock`을 고려하여 `reservable_stock <= total_stock - reserved_stock` 조건을 만족해야 한다.

Request:

```json
{
  "seller_id": 2,
  "total_stock": 100,
  "reservable_stock": 70
}
```

### GET /seller/stores/:storeId/reservations?sellerId=2

판매자 매장의 예약 목록을 조회한다.

### PATCH /seller/reservations/:reservationId/status

판매자가 예약 상태를 변경한다.

Request:

```json
{
  "seller_id": 2,
  "status": "APPROVED"
}
```

허용 상태 전이:

```text
PENDING -> APPROVED
PENDING -> CANCELED
APPROVED -> CANCELED
APPROVED -> PICKED_UP
```

재고 처리:

```text
- APPROVED: 예약 상태만 변경한다.
- CANCELED: reservable_stock을 복구하고 reserved_stock을 감소시킨다.
- PICKED_UP: reserved_stock과 total_stock을 감소시켜 실제 판매 완료를 반영한다.
- 상태 변경과 재고 변경은 같은 트랜잭션에서 처리한다.
```

## 7. Reservation API

### POST /reservations

소비자가 상품을 예약한다.

Request:

```json
{
  "user_id": 1,
  "inventory_id": 1,
  "quantity": 2,
  "visit_time": "2026-05-16T16:30:00",
  "request_note": "방문 전에 준비 부탁드립니다."
}
```

Success:

```json
{
  "data": {
    "reservation_id": 1,
    "status": "PENDING",
    "remaining_reservable_stock": 16
  },
  "message": "예약 요청이 완료되었습니다."
}
```

예약 처리 규칙:

```text
1. START TRANSACTION을 시작한다.
2. inventories 행을 SELECT ... FOR UPDATE로 잠근다.
3. 매장 opening_hours가 파싱 가능한 형식이면 visit_time이 영업시간 안인지 확인한다.
4. reservable_stock >= quantity인지 1차 확인한다.
5. 조건부 UPDATE로 reservable_stock 감소와 reserved_stock 증가를 동시에 처리한다.
6. UPDATE affectedRows가 1인지 확인한다. 0이면 재고 부족으로 판단한다.
7. reservations 행을 PENDING 상태로 생성한다.
8. reservation_status_logs에 최초 상태 로그를 기록한다.
9. 모든 작업이 성공하면 COMMIT한다.
10. 중간에 하나라도 실패하면 ROLLBACK한다.
```

조건부 재고 차감 SQL 예시:

```sql
UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?
  AND reservable_stock >= ?;
```

회복 및 중복 요청 처리:

```text
- 예약 생성 중 DB 오류, 서버 오류, 검증 실패가 발생하면 반드시 ROLLBACK한다.
- 재고만 감소하고 예약이 생성되지 않는 부분 반영 상태가 발생하면 안 된다.
- 동일 사용자가 같은 inventory_id, visit_time, quantity로 짧은 시간 안에 반복 요청한 경우 중복 예약 가능성을 검증한다.
- 초기 구현에서는 user_id + inventory_id + visit_time + status(PENDING/APPROVED) 기준으로 중복 예약을 막는다.
- 최종 구조에서는 Idempotency-Key 헤더를 받아 같은 요청의 중복 처리를 더 안전하게 막을 수 있다.
```

재고 부족 시:

```json
{
  "message": "예약 가능 재고가 부족합니다.",
  "code": "INSUFFICIENT_STOCK"
}
```

### GET /users/:userId/reservations

소비자의 예약 내역을 조회한다.

### PATCH /reservations/:reservationId/cancel

소비자가 예약을 취소한다.

취소 가능 상태:

```text
PENDING
APPROVED
```

취소 불가 상태:

```text
CANCELED
PICKED_UP
```

취소 시 재고 처리:

```text
1. START TRANSACTION을 시작한다.
2. reservations 행을 SELECT ... FOR UPDATE로 잠근다.
3. 예약 상태가 취소 가능한 상태인지 확인한다.
4. 연결된 inventories 행을 SELECT ... FOR UPDATE로 잠근다.
5. reserved_stock을 quantity만큼 감소시킨다.
6. reservable_stock을 quantity만큼 증가시킨다.
7. reservation.status = CANCELED로 변경한다.
8. reservation_status_logs에 상태 변경 이력을 남긴다.
9. 성공 시 COMMIT, 실패 시 ROLLBACK한다.
```

## 7. Seller API

### GET /seller/stores

판매자가 관리하는 매장 목록을 조회한다.

### PATCH /seller/stores/:storeId

매장 정보를 수정한다.

### POST /seller/products

판매자가 상품을 등록하고 해당 매장의 초기 재고를 생성한다.

상품 이미지는 파일 자체가 아니라 업로드 후 생성된 `image_url`을 저장한다.

Request:

```json
{
  "store_id": 1,
  "name": "버터떡",
  "category_id": 1,
  "description": "고소한 버터 풍미 디저트",
  "price": 3500,
  "image_url": "/uploads/products/butter-rice-cake.jpg",
  "total_stock": 40,
  "reservable_stock": 18,
  "low_stock_threshold": 5
}
```

Response:

```json
{
  "data": {
    "product_id": 1,
    "inventory_id": 1
  },
  "message": "상품이 등록되었습니다."
}
```

### GET /seller/stores/:storeId/products

판매자가 등록한 상품과 재고를 조회한다.

### PATCH /seller/inventories/:inventoryId

판매자가 재고를 수정한다.

Request:

```json
{
  "total_stock": 40,
  "reservable_stock": 18
}
```

검증 규칙:

```text
- reservable_stock + reserved_stock <= total_stock
- total_stock >= reserved_stock
- reserved_stock은 판매자가 직접 수정할 수 없다. 예약/취소/수령 완료 처리로만 변경된다.
- 판매자는 본인이 소유한 매장의 inventory만 수정할 수 있다.
```

### POST /seller/inventories/:inventoryId/offline-sales

판매자가 오프라인 판매량을 반영한다.

Request:

```json
{
  "quantity": 3
}
```

처리 규칙:

```text
1. 판매자가 해당 inventory의 매장 소유자인지 확인한다.
2. START TRANSACTION을 시작한다.
3. inventories 행을 SELECT ... FOR UPDATE로 잠근다.
4. quantity <= reservable_stock인지 확인한다.
5. total_stock과 reservable_stock을 quantity만큼 함께 감소시킨다.
6. 성공 시 COMMIT, 실패 시 ROLLBACK한다.
```

정책:

```text
오프라인 판매는 온라인 예약 가능 재고에서 우선 차감한다.
이미 예약된 reserved_stock은 오프라인 판매로 차감할 수 없다.
```

### GET /seller/stores/:storeId/reservations?sellerId=8

선택한 판매자 매장의 예약 목록을 조회한다.

Response:

```json
{
  "data": [
    {
      "reservation_id": 8,
      "user_id": 1,
      "customer_name": "김용준",
      "inventory_id": 14,
      "quantity": 1,
      "status": "PENDING",
      "visit_time": "2026-05-21T06:00:00.000Z",
      "request_note": "방문 전 연락 부탁드립니다.",
      "product_name": "두쫀쿠",
      "store_name": "두쫀쿠마스터"
    }
  ],
  "message": "success"
}
```

### PATCH /seller/reservations/:reservationId/status

판매자가 예약 상태를 변경한다.

Request:

```json
{
  "seller_id": 8,
  "status": "APPROVED"
}
```

허용 상태 전이:

```text
PENDING -> APPROVED
PENDING -> CANCELED
APPROVED -> PICKED_UP
APPROVED -> CANCELED
```

상태 변경 규칙:

```text
- 판매자는 본인 매장의 예약만 변경할 수 있다.
- 현재 상태를 조회한 뒤 허용된 상태 전이인지 검증한다.
- CANCELED, PICKED_UP 상태는 최종 상태로 보고 되돌리지 않는다.
- CANCELED 처리 시 예약 취소와 동일하게 재고를 복구한다.
- PICKED_UP 처리 시 reserved_stock과 total_stock을 quantity만큼 감소시킨다.
- 모든 상태 변경은 reservation_status_logs에 기록한다.
```


## 8. Upload API

### POST /uploads/product-image

판매자가 상품 대표 이미지를 업로드한다.

Request:

```text
multipart/form-data
file: 이미지 파일
```

Response:

```json
{
  "data": {
    "image_url": "/uploads/products/abc.jpg"
  },
  "message": "이미지가 업로드되었습니다."
}
```

검증 규칙:

```text
- jpg, jpeg, png, webp만 허용한다.
- 파일 크기는 초기 구현 기준 5MB 이하로 제한한다.
- DB에는 파일 바이너리가 아니라 image_url만 저장한다.
- 현재 로컬 프로토타입은 /api/uploads/products로 이미지를 서버 public/uploads/products에 저장한다.
- AWS 전환 시 같은 image_url 정책을 유지하고 저장소만 S3 같은 객체 스토리지로 바꿀 수 있다.
```

## 9. Admin API

### GET /admin/users

사용자 계정을 조회한다.

### GET /admin/sellers/pending

승인 대기 판매자 목록을 조회한다.

### PATCH /admin/sellers/:sellerId/approval

판매자 승인 상태를 변경한다.

Request:

```json
{
  "approval_status": "APPROVED"
}
```

### GET /admin/stores/pending

승인 대기 매장 목록을 조회한다.

Response:

```json
{
  "data": [
    {
      "store_id": 6,
      "seller_id": 4,
      "name": "두쫀쿠마스터",
      "address": "인천광역시 미추홀구 인하로77번길",
      "latitude": 37.4522563,
      "longitude": 126.6574571,
      "phone": "032-1111-1111",
      "opening_hours": "10:00~20:00",
      "approval_status": "PENDING",
      "business_name": "김용준 판매자",
      "representative_name": "김용준",
      "contact_phone": "01000000000",
      "user_id": 8,
      "login_id": "seller_login",
      "seller_name": "김용준"
    }
  ],
  "message": "success"
}
```

### PATCH /admin/stores/:storeId/approval

매장 승인 상태를 변경한다.

Request:

```json
{
  "approval_status": "APPROVED"
}
```

검증 규칙:

```text
- approval_status는 APPROVED 또는 REJECTED만 허용한다.
- 현재 PENDING 상태인 매장만 승인/반려 처리할 수 있다.
- APPROVED 처리된 매장만 소비자 검색 결과에 노출된다.
- REJECTED 처리된 매장은 승인 대기 목록에서 제외되고 소비자 검색에도 노출되지 않는다.
```

Response:

```json
{
  "data": {
    "store_id": 6,
    "seller_id": 4,
    "name": "두쫀쿠마스터",
    "address": "인천광역시 미추홀구 인하로77번길",
    "latitude": 37.4522563,
    "longitude": 126.6574571,
    "approval_status": "APPROVED",
    "seller_name": "김용준"
  },
  "message": "success"
}
```

### GET /admin/keywords

기준 키워드와 별칭 목록을 조회한다.

### POST /admin/keywords

새 기준 키워드를 생성한다.

검증 규칙:

```text
- 2자 이상 20자 이하
- 공백 금지
- 맛집, 예약, 파는곳, 추천, 근처, 요즘, 신상 등 검색 의도 단어 금지
- 기존 기준 키워드와 중복 금지
```

Request:

```json
{
  "keyword_name": "크림떡"
}
```

### POST /admin/keyword-aliases

기존 기준 키워드에 별칭을 등록한다.

Request:

```json
{
  "keyword_id": 1,
  "alias": "버터 떡 파는곳"
}
```

### GET /admin/unmapped-searches

미매핑 검색어 목록을 조회한다.

### PATCH /admin/unmapped-searches/:id/resolve

미매핑 검색어를 처리한다.

별칭 등록:

```json
{
  "action": "REGISTER_ALIAS",
  "keyword_id": 1
}
```

새 키워드 생성:

```json
{
  "action": "CREATE_KEYWORD",
  "keyword_name": "크림떡"
}
```

보류:

```json
{
  "action": "HOLD",
  "reason": "검색량 증가 시 재검토"
}
```

반려:

```json
{
  "action": "REJECT",
  "reason": "상품 키워드로 부적절"
}
```

처리 취소:

```json
{
  "action": "UNDO"
}
```

처리 취소를 지원하기 위한 기록 항목:

```text
- resolved_action
- resolved_keyword_id
- created_keyword_id
- resolution_note
- resolved_by
- resolved_at
```

### GET /admin/search-logs

검색 로그를 조회한다.

Response:

```json
{
  "data": [
    {
      "log_id": 1,
      "raw_query": "부평역 주변 버터떡",
      "mapping_status": "MAPPED",
      "keyword_name": "버터떡",
      "location_query": "부평역",
      "user_role": "CONSUMER",
      "result_count": 3,
      "created_at": "2026-05-16T17:20:00"
    }
  ]
}
```

### GET /admin/search-summary

관리자 대시보드용 검색 요약 통계를 조회한다.

Response:

```json
{
  "data": {
    "total_search_count": 320,
    "mapped_search_count": 280,
    "unmapped_search_count": 40,
    "top_keywords": [
      {
        "keyword_id": 1,
        "keyword_name": "버터떡",
        "search_count": 92
      }
    ]
  }
}
```

## 10. 인증과 권한 정책

현재 프로토타입은 `/auth/login` 또는 `/auth/register` 응답의 `user`를 프론트엔드 `currentUser`로 보관하고, 해당 `user_id`를 예약/판매자 API에 전달한다. 단, API 명세와 코드 구조는 최종적으로 JWT 기반 인증으로 전환하기 쉽게 작성한다.

역할별 접근 규칙:

```text
- /seller/*: SELLER만 접근 가능
- /admin/*: ADMIN만 접근 가능
- 소비자 예약 API: CONSUMER 또는 본인 사용자만 접근 가능
- 판매자 API는 본인 소유 매장/재고/예약만 수정 가능
```

## 11. 병행제어와 회복 정책

데이터 정합성이 중요한 작업은 반드시 트랜잭션으로 처리한다.

트랜잭션 필수 API:

```text
- POST /reservations
- PATCH /reservations/:reservationId/cancel
- PATCH /seller/reservations/:reservationId/status
- PATCH /seller/inventories/:inventoryId
- POST /seller/inventories/:inventoryId/offline-sales
- PATCH /admin/unmapped-searches/:id/resolve
```

병행제어 정책:

```text
- 예약 생성/취소/수령 완료/오프라인 판매는 inventory 행을 SELECT ... FOR UPDATE로 잠근다.
- 재고 차감은 조건부 UPDATE와 affectedRows 확인을 함께 사용한다.
- 같은 재고에 동시에 여러 예약 요청이 들어와도 reservable_stock이 음수가 되면 안 된다.
- 예약 상태 변경은 reservation 행을 잠근 뒤 현재 상태 기준으로 검증한다.
```

회복 정책:

```text
- 트랜잭션 중 하나의 작업이라도 실패하면 ROLLBACK한다.
- 재고 변경과 예약 생성/상태 변경은 부분적으로만 반영되면 안 된다.
- 서버가 응답 전 실패하더라도 DB에는 COMMIT된 데이터만 남아야 한다.
- 상태 변경 이력은 reservation_status_logs에 남겨 장애 후 추적과 수동 복구 근거로 사용한다.
- 관리자 미매핑 처리도 처리 이력을 남겨 실수 발생 시 UNDO할 수 있게 한다.
```

## 12. 백엔드 구현 우선순위

현재 프론트와 연결하기 위한 추천 구현 순서:

```text
1. DB 연결 설정 확인
2. GET /health
3. GET /products/trending
4. GET /search?query=...&lat=...&lng=...
5. POST /reservations 트랜잭션 및 조건부 재고 차감
6. PATCH /reservations/:reservationId/cancel 트랜잭션 및 재고 복구
7. POST /uploads/product-image
8. GET /seller/stores/:storeId/products
9. PATCH /seller/inventories/:inventoryId
10. POST /seller/inventories/:inventoryId/offline-sales
11. GET /seller/reservations
12. PATCH /seller/reservations/:reservationId/status
13. GET /admin/unmapped-searches
14. PATCH /admin/unmapped-searches/:id/resolve
15. GET /admin/search-logs
16. GET /admin/search-summary
```
