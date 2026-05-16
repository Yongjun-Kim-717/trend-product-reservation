# 최신 요구사항 명세서

최종 수정일: 2026-05-16

## 1. 프로젝트 목적

사용자 위치 기반으로 주변 매장의 유행 상품을 탐색하고, 카카오맵 기반 화면에서 매장 위치를 확인하며, 매장별 예약 가능 재고를 조회하고 상품을 예약할 수 있는 플랫폼을 개발한다.

시스템 사용자는 소비자, 판매자, 관리자 3종류로 구분한다. 각 역할은 서로 다른 데이터를 저장하고 관리하므로, 프론트엔드 화면과 데이터베이스 구조도 역할별로 분리한다.

## 2. 사용자 역할

### 2.1 소비자 User

소비자는 서비스를 이용해 상품을 찾고 예약하는 사용자이다.

주요 기능:

- 소비자 역할 선택 및 로그인
- 유행 상품 검색
- 현재 위치 기반 주변 매장 조회
- 카카오맵 기반 매장 위치 확인
- 상품별 판매 매장 확인
- 매장별 상품 재고 확인
- 상품 예약
- 예약 취소
- 본인 예약 내역 조회

소비자 전용 저장 정보:

- 닉네임
- 기본 위치 또는 최근 위치
- 알림 수신 여부

### 2.2 판매자 Store Owner / Seller

판매자는 매장과 상품 재고를 관리하는 사용자이다.

주요 기능:

- 판매자 역할 선택 및 로그인
- 매장 정보 등록 및 수정
- 판매 상품 등록
- 상품 대표 이미지 등록
- 상품별 재고 입력 및 수정
- 예약 가능 재고 설정
- 예약 목록 확인
- 예약 승인
- 예약 취소
- 수령 완료 처리
- 오프라인 판매량 반영

판매자 전용 저장 정보:

- 사업자명
- 사업자등록번호
- 대표자명
- 연락처
- 판매자 승인 상태
- 매장 정보

### 2.3 관리자 Admin

관리자는 서비스 전체 데이터와 운영 정책을 관리하는 사용자이다.

주요 기능:

- 관리자 역할 선택 및 로그인
- 사용자 계정 관리
- 판매자 승인 및 반려
- 매장 승인 및 반려
- 상품 카테고리 관리
- 유행 상품 키워드 등록 및 관리
- KeywordAlias 관리
- 미매핑 검색어 검토
- 미매핑 검색어를 기존 키워드 별칭으로 등록
- 미매핑 검색어를 신규 키워드로 생성
- 부적절한 상품 및 매장 데이터 관리
- 검색 로그 조회
- 유행 상품 순위 관리
- 시스템 통계 확인

관리자 전용 저장 정보:

- 소속 부서
- 권한 등급
- 운영 권한

## 3. 현재 프론트엔드 화면 경로

현재 프론트엔드는 역할별 화면을 라우팅으로 분리한다.

```text
/login
/consumer
/consumer/reservations/new
/seller
/seller/products/new
/admin
```

화면별 목적:

```text
/login
- 소비자 / 판매자 / 관리자 역할 선택
- 로그인 화면

/consumer
- 소비자 메인 화면
- 상품 검색
- 추천 유행 상품
- 위치 기반 지도
- 주변 매장 목록

/consumer/reservations/new
- 상품 예약 화면
- 상품 정보, 매장 정보, 재고 정보, 수량, 방문 예정 시간 입력

/seller
- 판매자 메인 화면
- 가게 정보, 등록 상품, 재고 수정, 예약 관리

/seller/products/new
- 판매자 상품 등록 화면
- 상품 정보, 대표 이미지, 재고 설정

/admin
- 관리자 데이터 관리 화면
- 사용자, 승인, 카테고리, 키워드, 미매핑 검색어, 검색 로그 관리
```

## 4. 상품 이미지 관리 방식

상품 이미지는 단일 대표 이미지만 사용한다.

데이터베이스에는 이미지 파일 자체를 저장하지 않고, 이미지 파일의 경로 또는 URL만 저장한다.

권장 컬럼:

```text
products.image_url
```

실제 이미지 파일은 나중에 백엔드 서버의 정적 업로드 폴더에 저장한다.

예시 저장 위치:

```text
backend/uploads/products/
```

예시 DB 값:

```text
products.image_url = /uploads/products/butter-rice-cake.jpg
```

이 방식의 장점:

- DB에는 상품 메타데이터와 이미지 참조 정보만 저장한다.
- 이미지 파일은 서버 파일 시스템에서 관리한다.
- DB 백업과 조회가 가벼워진다.
- 프론트엔드는 API 응답의 `image_url`을 이용해 이미지를 표시할 수 있다.

## 5. 재고 관리 요구사항

재고는 반드시 다음 세 값으로 분리한다.

```text
total_stock
reservable_stock
reserved_stock
```

각 컬럼의 의미:

```text
total_stock
- 실제 매장에 존재하는 전체 재고

reservable_stock
- 온라인 예약이 가능한 재고

reserved_stock
- 이미 예약된 재고
```

예약 규칙:

- 예약은 `reservable_stock` 범위 안에서만 가능하다.
- 예약 생성 시 `reservable_stock`은 예약 수량만큼 감소한다.
- 예약 생성 시 `reserved_stock`은 예약 수량만큼 증가한다.
- 동시 예약으로 재고가 음수가 되지 않도록 트랜잭션과 행 잠금을 사용한다.

권장 예약 트랜잭션 흐름:

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

## 6. 검색어 및 유행 상품 관리 요구사항

사용자의 검색어를 그대로 유행 상품 기준 키워드로 사용하지 않는다.

검색어 처리 흐름:

1. 사용자가 검색어를 입력한다.
2. 시스템은 입력된 검색어를 `keyword_aliases.alias`와 비교한다.
3. 별칭 매핑에 성공하면 기준 키워드인 `keywords.keyword_id`와 연결된 검색 로그를 저장한다.
4. 별칭 매핑에 실패하면 `unmapped_searches`에 저장하거나 기존 미매핑 검색어의 count를 증가시킨다.
5. 관리자는 미매핑 검색어를 검토한다.
6. 관리자는 해당 검색어를 기존 키워드의 별칭으로 등록하거나 신규 키워드로 생성한다.

예시:

```text
"버터떡", "버터 떡", "버터떡 맛집"
→ 기준 키워드: "버터떡"
```

## 7. 주요 인덱스 요구사항

권장 인덱스:

```text
stores(latitude, longitude)
inventories(store_id, product_id)
reservations(user_id)
reservations(inventory_id, status)
keyword_aliases(alias) UNIQUE 또는 FULLTEXT
search_logs(keyword_id, created_at)
unmapped_searches(raw_query) UNIQUE
```

## 8. 현재 프론트엔드가 기대하는 데이터 형태

현재 프론트엔드는 mock 데이터를 사용하지만, 이후 API 연결 시 아래 형태의 데이터를 기대한다.

### Product

```json
{
  "product_id": 1,
  "name": "버터떡",
  "category": "디저트",
  "description": "상품 설명",
  "price": 3500,
  "image_url": "/uploads/products/example.jpg",
  "status": "ACTIVE"
}
```

### Store

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

### Inventory

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

### Reservation

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

## 9. 우선 구현 범위

시간이 촉박한 상황을 고려해 우선순위는 다음과 같이 둔다.

1. 역할별 사용자 구조
2. 판매자와 매장 연결
3. 상품 및 대표 이미지 URL 관리
4. 매장별 상품 재고 관리
5. 소비자 예약 생성
6. 예약 상태 변경
7. 키워드 및 별칭 관리
8. 미매핑 검색어 관리
9. 검색 로그 및 유행 상품 순위
