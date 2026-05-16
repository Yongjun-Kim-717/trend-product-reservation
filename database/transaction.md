# Transaction Specification (DB Safety Rules)

최종 수정일: 2026-05-17

---

# 1. 목적

본 문서는 트랜잭션이 필요한 핵심 DB 작업과 동시성 문제를 방지하기 위한 규칙을 정의한다.

주요 목적은 다음과 같다:

- 재고 음수 방지
- 동시 예약 충돌 방지
- 데이터 무결성 유지
- 예약 상태 일관성 보장

---

# 2. 핵심 원칙

## 2.1 모든 재고 변경은 트랜잭션으로 처리한다

다음 조건을 반드시 만족해야 한다:

- SELECT ... FOR UPDATE 사용
- 재고 감소는 원자적으로 처리
- 예약 생성과 재고 변경은 반드시 한 트랜잭션으로 묶는다

---

## 2.2 재고는 절대 음수가 될 수 없다

다음 조건을 항상 만족해야 한다:

- reservable_stock >= quantity
- reserved_stock + reservable_stock <= total_stock

이 조건은 반드시 백엔드에서 검증해야 한다.

---

## 2.3 트랜잭션은 짧게 유지한다

- SELECT FOR UPDATE 이후 외부 API 호출 금지
- DB 작업만 트랜잭션 안에서 수행

---

# 3. 예약 생성 트랜잭션

## 3.1 대상 API

- POST /reservations

---

## 3.2 사용 테이블

- inventories
- reservations

---

## 3.3.0 inventory 식별 규칙 (중요)

예약 요청은 store_id + product_id 기반으로도 가능하다.

이 경우 백엔드는 먼저 inventories 테이블에서 inventory_id를 조회한 후
해당 inventory_id를 기준으로 이후 트랜잭션을 수행한다.

```sql
SELECT inventory_id, reservable_stock, reserved_stock, total_stock
FROM inventories
WHERE store_id = ? AND product_id = ?;
```

## 3.3 트랜잭션 흐름

START TRANSACTION;

```sql
-- 1. 재고 행 잠금 (동시성 제어)
SELECT inventory_id, reservable_stock, reserved_stock, total_stock
FROM inventories
WHERE inventory_id = ?
FOR UPDATE;

-- 2. 재고 검증
-- reservable_stock >= quantity 확인

-- 3. 재고 업데이트
UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?;

-- 4. 예약 생성
INSERT INTO reservations (
  user_id,
  inventory_id,
  quantity,
  status,
  created_at
) VALUES (
  ?, ?, ?, 'PENDING', NOW()
);

COMMIT;
```

---

## 3.4 실패 조건 (ROLLBACK)

다음 조건에서 반드시 롤백:

reservable_stock < quantity
inventory 존재하지 않음
UPDATE 실패

---

# 4. 예약 취소 트랜잭션

## 4.1 API
- PATCH /reservations/:id/cancel

---

## 4.2 흐름

```sql
START TRANSACTION;

-- 1. 예약 조회
SELECT inventory_id, quantity, status
FROM reservations
WHERE reservation_id = ?
FOR UPDATE;

-- 2. 상태 검증
-- PICKED_UP 상태는 취소 불가

-- 3. 재고 복구
UPDATE inventories
SET reservable_stock = reservable_stock + ?,
    reserved_stock = reserved_stock - ?
WHERE inventory_id = ?
  AND reserved_stock >= ? AND status IN ('PENDING', 'APPROVED')

-- 4. 예약 상태 변경
UPDATE reservations
SET status = 'CANCELED'
WHERE reservation_id = ?
  AND status != 'PICKED_UP';

COMMIT;
```

---

# 5. 예약 승인 트랜잭션

## 5.1 API

- PATCH /reservations/:id/approve

---

## 5.2 흐름

```sql
START TRANSACTION;

UPDATE reservations
SET status = 'APPROVED'
WHERE reservation_id = ? AND status = 'PENDING';

COMMIT;
```

- 재고는 예약 생성 시 이미 반영되므로 변경하지 않는다.

---

# 6. 예약 수령 완료 트랜잭션

## 6.1 API

- PATCH /reservations/:id/pickup

---

# 6.2 흐름

```sql
START TRANSACTION;

-- 1. 예약 정보 조회 및 잠금
SELECT inventory_id, quantity, status 
FROM reservations 
WHERE reservation_id = ? 
FOR UPDATE;

-- status = 'APPROVED' 인지 확인

-- 2. 실제 출고 처리 (총 재고와 예약 재고를 동시에 깎음, 만약 예약시점에 총 제고를 줄이고 싶으면 수정가능(지금은 출고시 총 제고 줄어듦))
UPDATE inventories
SET total_stock = total_stock - ?,
    reserved_stock = reserved_stock - ?
WHERE inventory_id = ?;

-- 3. 상태 변경
UPDATE reservations
SET status = 'PICKED_UP'
WHERE reservation_id = ?;

COMMIT;
```

---

# 7. 검색 로그 트랜잭션

## 7.1 API

- POST /search/log

---

## 7.2 흐름

```sql
START TRANSACTION;

-- 1. keyword_aliases 매칭
SELECT keyword_id
FROM keyword_aliases
WHERE alias = ?;

-- 2. 매칭 성공
INSERT INTO search_logs (user_id, keyword_id, raw_query)
VALUES (?, ?, ?);

-- 3. 매칭 실패
INSERT INTO unmapped_searches (raw_query, count)
VALUES (?, 1)
ON DUPLICATE KEY UPDATE count = count + 1;

COMMIT;
```

---

# 8. 동시성 제어 규칙

## 8.1 FOR UPDATE 사용

다음 작업은 반드시 행 잠금을 사용해야 한다:

- 예약 생성
- 예약 취소
- 재고 변경

---

## 8.2 동시 실행 금지 상황

- 동일 inventory에 대한 동시 예약 생성
- 재고 감소 작업 동시 수행

---

# 9. 성능 및 인덱스 기준

필수 인덱스

- inventories(store_id, product_id)
- reservations(user_id)
- reservations(inventory_id, status)
- keyword_aliases(alias)
- search_logs(keyword_id, created_at)

권장 사항

- 트랜잭션은 최대한 짧게 유지
- DB 외 작업은 트랜잭션 밖에서 수행
- 모든 재고 계산은 DB 기준으로만 처리

---

# 10. 결론

해당 시스템은 다음을 보장한다:

- 재고 음수 방지
- 동시 예약 충돌 방지
- 데이터 정합성 유지
- 검색 데이터 신뢰성 유지