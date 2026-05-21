# 데이터베이스 설계 문서

최종 수정일: 2026-05-22

## 1. 설계 목표

본 시스템의 데이터베이스는 유행 상품 검색, 위치 기반 매장 조회, 상품 재고 관리, 예약 처리, 운영자 데이터 관리를 안정적으로 지원하는 것을 목표로 한다.

핵심 설계 목표:

- 사용자 역할별로 필요한 정보를 분리해서 관리한다.
- 판매자 한 명이 여러 매장을 관리할 수 있게 한다.
- 같은 상품이 여러 매장에서 판매될 수 있게 한다.
- 매장별 재고와 예약 가능 재고를 분리한다.
- 예약과 재고 변경은 트랜잭션으로 정합성을 보장한다.
- 검색어를 기준 키워드와 별칭 구조로 정규화한다.
- 검색 로그를 기반으로 최근 인기 검색어를 산정한다.
- 위치 검색 결과는 캐시하여 외부 API 호출을 줄인다.

## 2. 개념적 설계

### 2.1 주요 개체

| 개체 | 설명 |
| --- | --- |
| User | 시스템에 로그인하는 공통 사용자 |
| ConsumerProfile | 소비자 역할에 필요한 추가 정보 |
| SellerProfile | 판매자 역할에 필요한 사업자 정보 |
| AdminProfile | 관리자 역할에 필요한 권한 정보 |
| Store | 판매자가 운영하는 매장 |
| ProductCategory | 상품 분류 |
| Product | 판매 가능한 상품 정보 |
| Inventory | 특정 매장의 특정 상품 재고 |
| Reservation | 소비자의 상품 예약 |
| ReservationStatusLog | 예약 상태 변경 이력 |
| Keyword | 유행 상품을 대표하는 기준 키워드 |
| KeywordAlias | 기준 키워드에 연결되는 검색어 별칭 |
| SearchLog | 사용자 검색 기록 |
| UnmappedSearch | 키워드 매핑에 실패한 검색어 |
| LocationCache | 장소명과 좌표 변환 결과 캐시 |

### 2.2 주요 관계

- User는 하나의 역할을 가진다.
- User는 역할에 따라 ConsumerProfile, SellerProfile, AdminProfile 중 하나의 프로필과 연결된다.
- SellerProfile은 여러 Store를 가질 수 있다.
- Store는 여러 Inventory를 가진다.
- Product는 여러 Store의 Inventory에 포함될 수 있다.
- Inventory는 여러 Reservation과 연결될 수 있다.
- Reservation은 하나의 User와 하나의 Inventory에 연결된다.
- Reservation은 여러 ReservationStatusLog를 가질 수 있다.
- Keyword는 여러 KeywordAlias를 가진다.
- Keyword는 여러 SearchLog와 연결될 수 있다.
- SearchLog는 매핑 성공 시 Keyword와 연결되고, 실패 시 UnmappedSearch로 관리된다.

## 3. 논리적 설계

### 3.1 사용자/권한 영역

#### users

모든 로그인 계정의 공통 정보를 저장한다.

주요 컬럼:

- `user_id`: 사용자 PK
- `role`: `CONSUMER`, `SELLER`, `ADMIN`
- `login_id`: 로그인 아이디, UNIQUE
- `password_hash`: 비밀번호 해시
- `name`: 사용자 이름
- `phone`: 연락처
- `status`: `ACTIVE`, `PENDING`, `SUSPENDED`

설계 근거:

- 로그인은 역할별 테이블이 아니라 `users`에서 공통 처리한다.
- 프론트엔드는 로그인 결과의 `role`에 따라 소비자, 판매자, 관리자 화면으로 이동한다.
- 계정 정지와 활성 상태는 공통 정책이므로 `users.status`로 관리한다.

#### consumer_profiles

소비자에게만 필요한 정보를 저장한다.

주요 컬럼:

- `user_id`: users FK이자 PK
- `nickname`
- `default_latitude`
- `default_longitude`
- `notification_enabled`

#### seller_profiles

판매자 사업자 정보와 승인 상태를 저장한다.

주요 컬럼:

- `seller_id`: 판매자 프로필 PK
- `user_id`: users FK, UNIQUE
- `business_name`
- `business_registration_no`: UNIQUE
- `representative_name`
- `contact_phone`
- `approval_status`: `PENDING`, `APPROVED`, `REJECTED`

설계 근거:

- 사용자 계정과 사업자 정보는 성격이 다르므로 분리했다.
- 판매자 승인 상태는 사용자 계정 활성 상태와 별개로 관리한다.
- 판매자 한 명이 여러 매장을 가질 수 있도록 Store가 `seller_id`를 FK로 가진다.

#### admin_profiles

관리자 권한 정보를 저장한다.

주요 컬럼:

- `user_id`: users FK이자 PK
- `department`
- `permission_level`

### 3.2 매장/상품/재고 영역

#### stores

판매자가 등록한 매장 정보를 저장한다.

주요 컬럼:

- `store_id`: 매장 PK
- `seller_id`: seller_profiles FK
- `name`
- `address`
- `latitude`
- `longitude`
- `phone`
- `opening_hours`
- `approval_status`

설계 근거:

- 소비자 검색 결과에는 `approval_status = 'APPROVED'`인 매장만 노출한다.
- 주소는 화면 표시용이고, 위치 기반 검색은 위도/경도를 사용한다.
- 좌표는 매장 등록 시 Kakao Local REST API로 주소를 변환해 저장한다.

#### product_categories

상품 카테고리를 저장한다.

주요 컬럼:

- `category_id`
- `name`
- `status`

설계 근거:

- 상품 등록 화면에서 카테고리 선택 목록으로 사용한다.
- 관리자 또는 DB 초기 데이터로 카테고리를 관리한다.

#### products

상품의 기본 정보를 저장한다.

주요 컬럼:

- `product_id`
- `name`
- `category_id`
- `description`
- `price`
- `image_url`
- `status`

설계 근거:

- 상품 이미지는 DB에 바이너리로 저장하지 않고 `image_url`만 저장한다.
- 현재 구현에서는 판매자가 등록한 상품이 `products`에 저장되고, 매장별 판매 여부와 재고는 `inventories`가 담당한다.
- 같은 키워드의 상품이라도 매장별 가격과 이미지가 다를 수 있으므로 인기 검색어 랭킹은 Product가 아니라 Keyword 기준으로 처리한다.

#### inventories

특정 매장에서 특정 상품을 얼마나 보유하고 예약 가능하게 했는지 저장한다.

주요 컬럼:

- `inventory_id`
- `store_id`
- `product_id`
- `total_stock`
- `reservable_stock`
- `reserved_stock`
- `updated_at`

제약 조건:

- `total_stock >= 0`
- `reservable_stock >= 0`
- `reserved_stock >= 0`
- `reservable_stock + reserved_stock <= total_stock`
- `(store_id, product_id)` UNIQUE

설계 근거:

- Store와 Product는 N:M 관계이므로 Inventory를 연결 테이블로 사용한다.
- Inventory는 단순 연결만 하는 것이 아니라 재고 상태를 가지므로 독립 개체로 설계했다.
- 예약 가능 재고와 예약된 재고를 분리해 온라인 예약 가능 수량을 명확히 관리한다.

### 3.3 예약 영역

#### reservations

소비자의 예약 정보를 저장한다.

주요 컬럼:

- `reservation_id`
- `user_id`
- `inventory_id`
- `quantity`
- `status`
- `visit_time`
- `request_note`
- `canceled_at`
- `picked_up_at`
- `created_at`
- `updated_at`

예약 상태:

- `PENDING`: 예약 대기
- `APPROVED`: 판매자 승인
- `CANCELED`: 예약 취소
- `PICKED_UP`: 수령 완료

설계 근거:

- 예약은 특정 Store와 Product를 직접 참조하지 않고 Inventory를 참조한다.
- Inventory를 참조하면 예약 대상의 매장, 상품, 재고를 한 번에 추적할 수 있다.

#### reservation_status_logs

예약 상태 변경 이력을 저장한다.

주요 컬럼:

- `log_id`
- `reservation_id`
- `previous_status`
- `new_status`
- `changed_by_user_id`
- `changed_by_role`
- `reason`
- `created_at`

설계 근거:

- 예약 상태가 바뀐 원인과 변경 주체를 추적할 수 있다.
- 발표 시 회복과 감사 로그의 근거로 설명할 수 있다.
- 상태 변경 중 장애가 발생하면 트랜잭션 롤백으로 상태와 재고가 함께 복구된다.

### 3.4 검색/키워드 영역

#### keywords

유행 상품을 대표하는 기준 키워드를 저장한다.

주요 컬럼:

- `keyword_id`
- `keyword_name`: UNIQUE
- `trend_score`
- `status`
- `updated_at`

설계 근거:

- 인기 검색어 랭킹은 Product가 아니라 Keyword 기준으로 집계한다.
- `trend_score`는 검색 로그가 부족할 때 관리자 추천 순위 fallback으로 사용할 수 있다.

#### keyword_aliases

기준 키워드에 연결되는 검색어 별칭을 저장한다.

주요 컬럼:

- `alias_id`
- `keyword_id`
- `alias`
- `alias_normalized`: UNIQUE

설계 근거:

- `버터떡`, `버터 떡`, `버터떡 맛집`처럼 표현이 달라도 같은 기준 키워드로 묶기 위함이다.
- 검색어 매핑은 `alias_normalized` 정확 일치를 우선 사용해 성능을 확보한다.

#### search_logs

사용자 검색 기록을 저장한다.

주요 컬럼:

- `log_id`
- `user_id`
- `keyword_id`
- `raw_query`
- `location_query`
- `result_count`
- `mapping_status`
- `created_at`

설계 근거:

- 최근 인기 검색어 집계의 기준 데이터이다.
- 사용자별 검색 기록, 검색 기준 위치, 검색 결과 수를 함께 남긴다.
- 검색 위치는 사용자 GPS 위치가 아니라 해당 검색이 기준으로 삼은 장소명을 의미한다.

#### unmapped_searches

키워드 매핑에 실패한 검색어를 저장한다.

주요 컬럼:

- `unmapped_id`
- `raw_query`
- `raw_query_normalized`: UNIQUE
- `count`
- `status`
- `resolved_action`
- `resolved_keyword_id`
- `created_keyword_id`
- `resolution_note`
- `resolved_by`
- `resolved_at`

상태:

- `PENDING`: 검토 필요
- `RESOLVED`: 처리 완료
- `HOLD`: 보류
- `REJECTED`: 반려

설계 근거:

- 매핑 실패 검색어를 버리지 않고 관리자 검토 대상으로 보관한다.
- 관리자는 기존 키워드 별칭으로 등록하거나 새 키워드로 만들 수 있다.
- 이미 처리한 검색어는 삭제할 수 있지만, 생성된 Keyword/KeywordAlias는 유지된다.

### 3.5 위치 캐시 영역

#### location_cache

장소명과 좌표 변환 결과를 저장한다.

주요 컬럼:

- `location_cache_id`
- `query`
- `query_normalized`: UNIQUE
- `latitude`
- `longitude`
- `source`
- `created_at`
- `updated_at`

설계 근거:

- Kakao Local REST API 호출을 줄이기 위해 장소명 -> 좌표 결과를 캐시한다.
- 사용자의 현재 위치는 캐시하지 않는다.
- 상품명 단독 검색어는 캐시하지 않는다.
- 좌표 조회에 실패한 장소는 캐시하지 않는다.

## 4. 물리적 설계

### 4.1 DBMS 및 문자셋

- DBMS: MariaDB
- 스토리지 엔진: InnoDB
- 문자셋: `utf8mb4`
- Collation: `utf8mb4_unicode_ci`

설계 근거:

- 한글 검색어, 매장명, 주소, 상품명 저장이 필요하다.
- InnoDB는 트랜잭션과 행 잠금을 지원하므로 예약/재고 정합성에 적합하다.

### 4.2 주요 PK/FK

- `users.user_id` PK
- `seller_profiles.user_id` -> `users.user_id`
- `stores.seller_id` -> `seller_profiles.seller_id`
- `products.category_id` -> `product_categories.category_id`
- `inventories.store_id` -> `stores.store_id`
- `inventories.product_id` -> `products.product_id`
- `reservations.user_id` -> `users.user_id`
- `reservations.inventory_id` -> `inventories.inventory_id`
- `reservation_status_logs.reservation_id` -> `reservations.reservation_id`
- `keyword_aliases.keyword_id` -> `keywords.keyword_id`
- `search_logs.keyword_id` -> `keywords.keyword_id`

### 4.3 주요 인덱스

| 인덱스 | 목적 |
| --- | --- |
| `users(login_id)` UNIQUE | 로그인 아이디 중복 방지 및 로그인 조회 |
| `stores(seller_id)` | 판매자별 매장 조회 |
| `stores(latitude, longitude)` | 기준 좌표 주변 매장 조회 후보 축소 |
| `inventories(store_id, product_id)` UNIQUE | 같은 매장에 같은 상품 중복 등록 방지 |
| `reservations(user_id)` | 소비자 내 예약 조회 |
| `reservations(inventory_id, status)` | 판매자 예약 관리 및 상태별 조회 |
| `reservation_status_logs(reservation_id, created_at)` | 예약별 상태 변경 이력 조회 |
| `keyword_aliases(alias_normalized)` UNIQUE | 검색어 별칭 정확 일치 매핑 |
| `search_logs(keyword_id, created_at)` | 최근 7일 인기 검색어 집계 |
| `unmapped_searches(raw_query_normalized)` UNIQUE | 미매핑 검색어 중복 누적 방지 |
| `location_cache(query_normalized)` UNIQUE | 장소 좌표 캐시 정확 일치 조회 |

### 4.4 location_cache 인덱스 작동 근거

`location_cache` 조회는 다음과 같이 정확 일치 조건을 사용한다.

```sql
SELECT *
FROM location_cache
WHERE query_normalized = ?
LIMIT 1;
```

`query_normalized`에 UNIQUE 인덱스가 있으므로 MariaDB는 전체 테이블을 처음부터 끝까지 훑지 않고 B-Tree 인덱스를 통해 조건에 맞는 값을 탐색한다. 한글도 초성 단위로 단순 분리해서 찾는 것이 아니라, 컬럼의 문자셋과 collation 규칙에 따라 정렬된 인덱스 키로 비교된다.

`LIMIT 1`은 조건에 맞는 결과를 최대 1개만 반환하라는 의미이다. `query_normalized`가 UNIQUE이므로 실제로도 같은 값은 1개만 존재하지만, API 로직에서 단일 캐시 결과만 필요하다는 의도를 명확히 표현한다.

### 4.5 예약 트랜잭션

예약 생성은 다음 SQL 흐름을 따른다.

```sql
START TRANSACTION;

SELECT *
FROM inventories
WHERE inventory_id = ?
FOR UPDATE;

UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?
  AND reservable_stock >= ?;

INSERT INTO reservations (...);
INSERT INTO reservation_status_logs (...);

COMMIT;
```

실패 시:

```sql
ROLLBACK;
```

설계 근거:

- `SELECT ... FOR UPDATE`는 해당 재고 행을 잠가 동시에 여러 예약이 같은 재고를 차감하는 문제를 막는다.
- 조건부 `UPDATE`는 재고가 부족할 때 차감이 일어나지 않게 한다.
- 예약 생성, 재고 차감, 상태 로그 기록은 하나의 트랜잭션으로 처리되어 일부만 반영되는 문제를 방지한다.

## 5. 실제 시스템 기능과 DB 연동

### 5.1 로그인

- 프론트 로그인 요청
- 백엔드가 `users.login_id`로 사용자 조회
- 비밀번호 검증 후 `role`, `user_id`, `name` 반환
- 프론트는 `role`에 따라 화면 이동

### 5.2 판매자 매장 등록

- 판매자가 매장명, 주소, 영업시간 입력
- 백엔드가 Kakao Local REST API로 주소를 좌표로 변환
- `stores`에 `approval_status = 'PENDING'`으로 저장
- 관리자가 승인하면 `APPROVED`로 변경
- 소비자 검색은 승인된 매장만 조회

### 5.3 상품 등록 및 재고 설정

- 판매자가 상품명, 카테고리, 이미지, 가격, 재고 입력
- `products`에 상품 기본 정보 저장
- `inventories`에 매장별 재고 저장
- 상품 이미지는 서버 `/uploads/products/...`에 저장하고 DB에는 URL만 저장

### 5.4 소비자 검색

- 검색어를 백엔드로 전달
- 백엔드가 상품 후보와 장소 후보 분리
- 상품 후보는 `keyword_aliases`와 매칭
- 장소 후보는 `location_cache` 조회 후 없으면 Kakao Local REST API 호출
- 기준 좌표 주변 승인 매장과 예약 가능 상품을 조회
- `search_logs`에 검색 기록 저장
- 매핑 실패 시 `unmapped_searches`에 저장 또는 count 증가

### 5.5 예약

- 소비자가 예약 요청
- 백엔드가 Inventory를 잠그고 재고를 검증
- 재고 차감과 예약 생성, 상태 로그 기록을 하나의 트랜잭션으로 처리
- 판매자는 예약 승인, 취소, 수령 완료 처리 가능

### 5.6 관리자 키워드 관리

- 미매핑 검색어를 확인
- 기존 Keyword에 Alias로 연결하거나 새 Keyword 생성
- 이후 같은 표현으로 검색하면 기준 키워드에 매핑된다.

## 6. 설계상 주요 판단

### 6.1 Keyword와 Product를 분리한 이유

Keyword는 사용자가 찾는 유행 상품의 대표 명칭이고, Product는 실제 매장에서 판매하는 상품이다. 같은 `두쫀쿠` 키워드라도 매장마다 상품 이미지, 가격, 설명, 재고가 다를 수 있으므로 인기 검색어 집계는 Keyword 기준으로 하고, 실제 예약은 Product/Inventory 기준으로 처리한다.

### 6.2 Inventory를 독립 테이블로 둔 이유

Store와 Product는 다대다 관계이다. 또한 매장별 재고는 단순 연결 정보가 아니라 `total_stock`, `reservable_stock`, `reserved_stock`이라는 핵심 상태를 가진다. 따라서 Inventory를 별도 개체로 설계했다.

### 6.3 reserved_stock이 필요한 이유

예약된 재고는 실제 보유 재고 안에 있지만, 아직 수령 완료되지 않은 수량이다. 이를 별도로 관리해야 예약 대기/승인 상태의 재고를 추적할 수 있고, 예약 취소 시 다시 예약 가능 재고로 되돌릴 수 있다.

### 6.4 location_cache를 둔 이유

검색어에 포함된 장소를 매번 Kakao Local REST API로 조회하면 속도와 외부 API 의존도가 커진다. 따라서 장소 후보가 명확하고 좌표 조회에 성공한 경우만 캐시한다. 사용자의 현재 GPS 좌표나 상품명 단독 검색어는 캐시하지 않는다.

## 7. 향후 개선 가능성

- `location_cache`에 `hit_count`, `last_used_at` 추가
- 검색 로그에 위치 해석 상태 컬럼 추가
- Keyword와 Product를 직접 연결하는 `keyword_products` 테이블 추가
- 이미지 저장소를 EC2 로컬 디스크에서 S3로 이전
- 관리자 작업 로그 테이블 추가
- 예약 만료 정책 추가

