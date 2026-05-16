# API 명세서

Base URL: `http://localhost:4000/api`

최종 수정일: 2026-05-16

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

## 3. 통합 검색 API

### GET /search?query=부평역%20주변%20버터떡

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
8. 매핑 성공 시 keyword_id 기준 상품 조회
9. 매핑 실패 시 unmapped_searches 저장 또는 count 증가
10. 기준 좌표 주변 매장 후보 조회
11. inventories와 products 조인
12. 거리 계산 및 거리순 정렬
13. search_logs 저장
14. 프론트에 검색 기준 위치, 키워드, 매장 목록 반환
```

Query Parameters:

```text
query: 사용자 검색어
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
- keyword_aliases.alias_normalized에 인덱스를 둔다.
- 위치 기반 매장 검색은 stores(latitude, longitude) 인덱스를 활용한다.
- 검색 로그 저장은 초기에는 동기 INSERT로 처리해도 된다.
```

## 4. Product API

### GET /products

상품 목록을 조회한다.

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

### GET /products/trending

유행 점수 또는 검색 로그 기준으로 유행 상품을 조회한다.

Response:

```json
{
  "data": [
    {
      "product_id": 1,
      "name": "버터떡",
      "keyword_name": "버터떡",
      "trend_score": 95,
      "image_url": "/uploads/products/butter-rice-cake.jpg"
    }
  ]
}
```

## 5. Store API

### GET /stores/nearby?lat=37.4895&lng=126.7247&productId=1

좌표와 상품 기준으로 주변 매장을 조회한다.

Query Parameters:

```text
lat: 기준 위도
lng: 기준 경도
productId: 선택 상품 ID, 선택값
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
      "distance_km": 28.4
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

## 6. Reservation API

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
1. inventories 행을 SELECT ... FOR UPDATE로 잠근다.
2. reservable_stock >= quantity인지 확인한다.
3. reservable_stock을 quantity만큼 감소시킨다.
4. reserved_stock을 quantity만큼 증가시킨다.
5. reservations 행을 PENDING 상태로 생성한다.
6. 트랜잭션을 커밋한다.
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

취소 시 재고 처리:

```text
reserved_stock 감소
reservable_stock 증가
reservation.status = CANCELED
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
reservable_stock + reserved_stock <= total_stock
```

### GET /seller/reservations

판매자 매장의 예약 목록을 조회한다.

### PATCH /seller/reservations/:reservationId/status

판매자가 예약 상태를 변경한다.

Request:

```json
{
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

## 8. Admin API

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

### PATCH /admin/stores/:storeId/approval

매장 승인 상태를 변경한다.

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

## 9. 백엔드 구현 우선순위

현재 프론트와 연결하기 위한 추천 구현 순서:

```text
1. DB 연결 설정 확인
2. GET /health
3. GET /products/trending
4. GET /search?query=...
5. POST /reservations 트랜잭션 처리
6. GET /seller/stores/:storeId/products
7. PATCH /seller/inventories/:inventoryId
8. GET /seller/reservations
9. PATCH /seller/reservations/:reservationId/status
10. GET /admin/unmapped-searches
11. PATCH /admin/unmapped-searches/:id/resolve
12. GET /admin/search-logs
```
