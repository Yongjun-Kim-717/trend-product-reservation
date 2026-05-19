# 데이터베이스 관리 정책

최종 수정일: 2026-05-20

## 1. 문서 목적

이 문서는 트렌드 상품 예약 시스템의 데이터 정합성, 성능, 회복, 운영 관리를 위한 기준을 정리한다. 특히 위치 기반 검색, 재고 예약, 검색 로그, 캐시 데이터처럼 데이터베이스 설계 의도가 중요한 영역을 명확히 한다.

## 2. 기본 원칙

```text
- 데이터베이스는 실제 서비스 데이터의 기준 저장소로 사용한다.
- Mock 데이터는 프론트 시안 단계에서만 사용하고, 시연 및 백엔드 연동 단계에서는 MariaDB 데이터를 사용한다.
- 사용자 입력값은 그대로 핵심 통계 기준으로 사용하지 않고, 정규화 또는 기준 키워드 매핑을 거친다.
- 예약, 취소, 재고 변경처럼 정합성이 중요한 작업은 트랜잭션으로 처리한다.
- 외부 API 호출 결과는 필요한 범위에서만 캐시하고, 사용자 위치 정보와 장소 좌표 캐시는 구분한다.
```

## 3. 인덱스 정확 일치 조회 정책

`location_cache.query_normalized`처럼 자주 조회되는 정규화 키에는 인덱스를 둔다.

```sql
SELECT *
FROM location_cache
WHERE query_normalized = ?
LIMIT 1;
```

위 쿼리는 전체 테이블을 순차적으로 훑는 방식이 아니라, `query_normalized` 인덱스의 정렬된 키 구조를 따라 조건에 맞는 행을 찾는다. MariaDB의 문자열 인덱스는 한글 초성만 별도로 분리해서 찾는 구조가 아니라, 컬럼의 문자셋과 collation 규칙에 따라 문자열 값을 비교하고 정렬한 인덱스 키를 사용한다.

`LIMIT 1`은 조건에 맞는 결과를 최대 1개만 반환하라는 의미다. `query_normalized`에 UNIQUE 인덱스가 있으면 같은 값은 하나만 존재하지만, 이 API는 단일 장소 좌표만 필요하다는 의도를 명확히 하기 위해 `LIMIT 1`을 사용한다.

금지하는 방식:

```text
- SELECT * FROM location_cache 후 백엔드에서 includes 비교
- WHERE query_normalized LIKE '%검색어%'
- 전국 지명/지번 데이터를 미리 모두 저장하는 방식
```

## 4. location_cache 관리 정책

`location_cache`는 사용자 현재 위치 저장용 테이블이 아니다. 이 테이블의 목적은 `장소명 -> 위도/경도` 변환 결과를 저장하여 Kakao Local REST API 호출을 줄이는 것이다.

저장 허용:

```text
- 검색어에서 추출한 장소 후보
- Kakao Local REST API가 좌표를 반환한 장소
- 관리자가 직접 등록한 고정 장소
- source = KAKAO_LOCAL 또는 MANUAL
```

저장 금지:

```text
- CLIENT_LOCATION
- 브라우저 Geolocation으로 받은 사용자 현재 위치
- DEFAULT_LOCATION
- 상품명 단독 검색어
- "맛집", "추천", "예약", "파는곳", "근처", "주변" 같은 의도어만 있는 값
- 너무 긴 자연어 문장 전체
```

장소 후보 검증 기준:

```text
- 전체 검색어가 아니라 검색어에서 추출한 장소 후보를 기준으로 검증한다.
- 공백 제거 후 2자 이상 20자 이하만 캐시 저장 후보로 인정한다.
- 예: "인하대학교 후문 맛집" -> 장소 후보 "인하대학교 후문"
- 예: "부평역 주변 버터떡" -> 장소 후보 "부평역"
```

추천 컬럼:

```sql
location_cache_id BIGINT PRIMARY KEY AUTO_INCREMENT,
query VARCHAR(100) NOT NULL,
query_normalized VARCHAR(100) NOT NULL,
latitude DECIMAL(10, 7) NOT NULL,
longitude DECIMAL(10, 7) NOT NULL,
source ENUM('KAKAO_LOCAL', 'MANUAL') NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
UNIQUE KEY uq_location_cache_query_normalized (query_normalized)
```

향후 운영 개선 후보:

```text
- hit_count 컬럼 추가
- last_used_at 컬럼 추가
- 6개월 이상 미사용이고 hit_count가 낮은 캐시 정리
```

현재 프로젝트에서는 메모리 LRU 캐시와 DB 캐시를 나누는 2단계 캐시 구조는 사용하지 않는다. 수업 프로젝트 범위에서는 DB 인덱스 기반 정확 일치 조회와 외부 API 호출 절감만으로 충분하다.

## 5. 검색어와 키워드 관리 정책

상품 검색어는 그대로 기준 상품으로 쓰지 않고 `Keyword`와 `KeywordAlias`를 통해 기준 키워드로 매핑한다.

```text
- "버터떡", "버터 떡", "버터떡 맛집"은 하나의 기준 키워드 "버터떡"으로 묶을 수 있다.
- 매핑 실패 검색어는 unmapped_searches에 저장한다.
- 관리자는 미매핑 검색어를 검토하여 기존 키워드 별칭으로 등록하거나 새 키워드로 생성한다.
```

기준 키워드 생성 제한:

```text
- 2자 이상 20자 이하
- 상품을 대표하는 명사 중심
- 공백 금지
- 맛집, 추천, 예약, 근처, 주변, 파는곳 같은 검색 의도어 금지
- 기존 기준 키워드와 중복 금지
```

### 5.1 검색어 판별 정책

검색어는 상품 의도, 장소 의도, 미매핑 검색어로 분류한다. 네이버지도처럼 `지명 + 대상` 형태의 검색을 일부 지원하기 위해 단순 조사 패턴만 사용하지 않고, 상품어를 먼저 찾은 뒤 남은 문자열을 장소 후보로 정규화한다.

처리 순서:

```text
1. 원본 검색어를 수신한다.
2. Keyword, KeywordAlias, Product 순서로 상품어를 매칭한다.
3. 매칭된 상품어를 원본 검색어에서 제거한다.
4. 상품어가 제거된 경우에만 남은 문자열을 장소 후보로 사용할 수 있다.
5. 남은 문자열에서 장소 의도어를 제거한다.
   - 주변, 근처, 인근, 근방, 부근, 앞, 쪽, 에서, 맛집, 추천, 예약, 파는곳
6. 상품어가 제거되지 않은 검색어는 명확한 장소 패턴이 있을 때만 장소 후보로 인정한다.
   - 예: 역, 주변, 근처, 인근, 에서, 맛집
7. 정리된 문자열을 장소 후보로 검증한다.
8. 장소 후보가 있으면 location_cache를 query_normalized 정확 일치로 조회한다.
9. 캐시에 없으면 Kakao Local REST API로 좌표를 조회한다.
10. 좌표 조회에 성공한 장소 후보만 location_cache에 저장한다.
11. 상품어도 장소 후보도 없으면 unmapped_searches에 저장하고 stores는 빈 배열로 반환한다.
```

예시:

```text
부평역 주변 버터떡
-> 상품어: 버터떡
-> 남은 문자열: 부평역 주변
-> 장소 후보 정규화: 부평역

송도 두쫀쿠
-> 상품어: 두쫀쿠
-> 남은 문자열: 송도
-> 장소 후보 정규화: 송도

인하대학교 후문에서 카페라떼
-> 상품어: 카페라떼
-> 남은 문자열: 인하대학교 후문에서
-> 장소 후보 정규화: 인하대학교 후문

강남역 딸기케이크 맛집
-> 상품어: 딸기케이크
-> 남은 문자열: 강남역 맛집
-> 장소 후보 정규화: 강남역
```

장소 캐시에 저장하지 않는 예시:

```text
카페라떼
-> Product 매칭 성공
-> 현재 기준 위치 기반 상품 검색
-> location_cache 저장 금지

딸기케이크
-> Product 매칭 성공
-> 현재 기준 위치 기반 상품 검색
-> location_cache 저장 금지

소금빵
-> 현재 Product/Keyword 미등록
-> 명확한 장소 후보 없음
-> unmapped_searches 저장
-> location_cache 저장 금지
```

주의할 점:

```text
- "송도 두쫀쿠"처럼 상품어가 제거된 뒤 남은 "송도"는 장소 후보로 인정한다.
- "소금빵"처럼 상품어 매칭이 없고 장소 패턴도 없는 단독어는 장소 후보로 인정하지 않는다.
- 단독어를 무조건 Kakao Local REST API로 보내면 상품명이 우연히 장소/매장명으로 검색되어 location_cache가 오염될 수 있다.
- 상품어도 장소 후보도 없는 검색어는 사용자의 현재 기준 위치가 있더라도 주변 전체 매장을 반환하지 않는다.
```

Kakao Local REST API 무결과 또는 실패 처리:

```text
- Kakao Local REST API가 장소 후보에 대한 좌표를 반환하지 않으면 location_cache에 저장하지 않는다.
- 좌표를 확정하지 못한 상태에서 주변 전체 매장을 반환하지 않는다.
- 상품어가 있는 검색어라면 사용자의 현재 기준 위치가 있을 때만 상품 기준 주변 매장을 조회한다.
- 상품어도 없고 위치도 확정하지 못하면 stores는 빈 배열로 반환하고 unmapped_searches에 저장한다.
- 외부 API 장애가 발생하면 500 오류로 노출하기보다, 가능하면 "위치 조회 실패" 상태를 반환하고 검색 로그에 실패 원인을 남기는 방향을 권장한다.
```

향후 개선 후보:

```text
- search_logs에 location_resolution_status 컬럼 추가
  - CACHE_HIT
  - KAKAO_HIT
  - KAKAO_NO_RESULT
  - KAKAO_ERROR
  - CLIENT_LOCATION
- unmapped_searches에 reason 컬럼 추가
  - UNKNOWN_PRODUCT
  - UNKNOWN_LOCATION
  - LOCATION_API_NO_RESULT
```

이 정책은 상용 지도 서비스 수준의 자연어 검색을 완전히 대체하지 않는다. 상용 지도 서비스는 대규모 POI 데이터, 자동완성, 형태소 분석, 검색 로그 랭킹, 머신러닝 기반 의도 분류 등을 함께 사용할 수 있다. 본 프로젝트에서는 DB 수업 범위에 맞춰 `KeywordAlias`, `Product`, `location_cache`, `SearchLog`, `UnmappedSearch`를 활용한 규칙 기반 하이브리드 파서를 사용한다.

## 6. 인기 키워드 랭킹 정책

인기 영역은 특정 `Product`가 아니라 `Keyword` 기준으로 산정한다. `Keyword`는 사용자가 찾는 유행 대상의 기준 이름이고, `Product`는 매장별 실제 판매 상품이다. 같은 키워드에 여러 매장의 상품, 가격, 이미지가 연결될 수 있으므로 인기 랭킹에서 임의의 상품 하나를 대표 상품처럼 보여주지 않는다.

개념 구분:

```text
Keyword
- 유행 대상의 기준 이름
- 예: 두쫀쿠, 버터떡, 소금빵

Product
- 실제 판매/예약 대상 상품
- 매장별 가격, 이미지, 재고가 달라질 수 있음

Inventory
- 특정 Store가 특정 Product를 얼마나 보유하고 예약 가능하게 열었는지 나타냄
```

랭킹 산정 기준:

```text
1. 최근 7일 search_logs를 기준으로 집계한다.
2. keyword_id가 있고 mapping_status = MAPPED인 검색만 집계한다.
3. keyword_id별 COUNT(*)를 search_count로 계산한다.
4. search_count DESC, 최근 검색 시각 DESC 순으로 정렬한다.
5. 검색 로그가 부족하면 keywords.trend_score 기준 관리자 추천 순위로 fallback한다.
```

프론트 표시 정책:

```text
- 소비자 화면에는 "유행 상품"이 아니라 "최근 인기 검색어"로 표시한다.
- 배지에는 "검색 N회" 또는 "추천"을 표시한다.
- "DB" 같은 개발용 배지는 사용자 화면에 표시하지 않는다.
- 인기 키워드를 클릭하면 keyword_name으로 검색을 수행하고, 그 결과로 주변 매장과 재고를 조회한다.
```

향후 DB 구조 개선 후보:

```text
- Keyword와 Product를 직접 1:N 또는 N:M으로 연결하는 KeywordProduct 테이블 추가 검토
- 현재는 키워드 랭킹과 상품/재고 조회를 API 로직에서 분리한다.
```

## 7. 재고와 예약 정합성 정책

재고는 다음 세 값으로 분리한다.

```text
total_stock: 실제 매장 보유 재고
reservable_stock: 온라인 예약 가능 재고
reserved_stock: 이미 예약된 재고
```

예약 생성 시 `reservable_stock` 범위 안에서만 예약할 수 있다. 같은 상품 재고에 동시에 여러 예약 요청이 들어와도 재고가 음수가 되면 안 된다.

예약 생성 트랜잭션 기준:

```sql
SELECT *
FROM inventories
WHERE inventory_id = ?
FOR UPDATE;

UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?
  AND reservable_stock >= ?;
```

`affectedRows`가 1인지 확인하고, 0이면 재고 부족 또는 동시성 충돌로 보고 ROLLBACK한다.

## 8. 병행제어 정책

트랜잭션 필수 작업:

```text
- 예약 생성
- 예약 취소
- 예약 승인/수령 완료 처리
- 오프라인 판매량 반영
- 판매자 재고 수정
- 관리자 미매핑 검색어 처리
```

병행제어 기준:

```text
- 재고 변경 전 inventory 행을 SELECT ... FOR UPDATE로 잠근다.
- 예약 상태 변경 전 reservation 행을 잠근다.
- 상태 전이는 현재 상태를 검증한 뒤 허용된 방향으로만 수행한다.
- 재고 차감/복구와 예약 상태 변경은 같은 트랜잭션 안에서 처리한다.
```

## 9. 회복과 감사 로그 정책

트랜잭션 중 하나라도 실패하면 ROLLBACK한다. 재고 변경과 예약 생성/상태 변경이 부분적으로만 반영되면 안 된다.

로그 관리:

```text
- search_logs: 검색어, 매핑 상태, 위치 기준, 결과 수 저장
- unmapped_searches: 매핑 실패 검색어와 검토 상태 저장
- reservation_status_logs: 예약 상태 변경 이력 저장
```

장애 또는 실수 발생 시 로그를 근거로 원인을 추적하고 수동 복구할 수 있어야 한다.

## 10. 이미지 데이터 관리 정책

상품 이미지는 단일 대표 이미지를 기준으로 한다. 데이터베이스에는 이미지 바이너리를 직접 저장하지 않고, 이미지 파일 경로 또는 URL을 저장한다.

```text
products.image_url: 대표 이미지 경로 또는 URL
```

로컬 개발에서는 `/uploads/...` 경로를 사용할 수 있고, AWS 배포 시에는 S3 같은 외부 스토리지 URL로 전환할 수 있다.

## 11. 데이터 보존 및 정리 정책

```text
- 예약 데이터는 시연 및 통계 확인을 위해 삭제보다 상태 변경을 우선한다.
- 검색 로그는 유행 상품 산정 근거이므로 일정 기간 보존한다.
- location_cache는 장소 좌표 재사용 목적이므로 오래 사용되지 않은 데이터는 정리 후보로 둔다.
- 사용자 계정 삭제가 필요한 경우 예약/검색 로그와의 참조 관계를 먼저 검토한다.
```

## 12. 현재 구현 기준 개선 예정

```text
- location_cache 조회는 정확 일치 인덱스 조회만 사용한다.
- CLIENT_LOCATION은 location_cache에 저장하지 않는다.
- 장소 후보 길이 제한은 공백 제거 후 2자 이상 20자 이하로 적용한다.
- 향후 DB 스키마에 hit_count, last_used_at 추가를 검토한다.
- 관리자 화면에서 location_cache 정리 기능은 현재 범위에서는 제외한다.
```
