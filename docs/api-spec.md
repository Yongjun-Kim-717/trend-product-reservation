# API Specification

Base URL: `http://localhost:4000/api`

## Health

### GET /health

서버와 DB 연결 상태를 확인한다.

## Products

### GET /products

상품 목록을 조회한다.

### GET /products/trending

유행 점수 기준 상품 목록을 조회한다. 구현 예정.

### GET /products/search?query=버터떡

검색어를 기준 키워드로 매핑하고 관련 상품을 조회한다. 구현 예정.

## Stores

### GET /stores/nearby?lat=37.5&lng=127.0

사용자 좌표 기준 주변 매장을 조회한다. 구현 예정.

### GET /stores/:storeId/inventories

특정 매장의 상품별 재고를 조회한다.

## Reservations

### POST /reservations

상품을 예약한다.

Request:

```json
{
  "userId": 1,
  "inventoryId": 1,
  "quantity": 2
}
```

Success:

```json
{
  "reservationId": 1,
  "status": "CONFIRMED"
}
```

예약 처리 규칙:

1. `inventories` 행을 `SELECT ... FOR UPDATE`로 잠근다.
2. `reservable_stock >= quantity`인지 확인한다.
3. `reservable_stock`을 감소시키고 `reserved_stock`을 증가시킨다.
4. `reservations` 행을 생성한다.
5. 트랜잭션을 커밋한다.

## Admin

### PATCH /admin/inventories/:inventoryId

매장 관리자가 재고를 수정한다. 구현 예정.

### GET /admin/unmapped-searches

매핑 실패 검색어 목록을 조회한다. 구현 예정.
