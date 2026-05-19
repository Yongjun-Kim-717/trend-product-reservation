# 최신 요구사항 명세서

최종 수정일: 2026-05-19

## 1. 프로젝트 개요

본 프로젝트는 유행 상품을 사용자의 위치 또는 검색 위치 기준으로 탐색하고, 카카오맵 기반으로 주변 매장 위치와 상품 재고를 확인한 뒤 예약까지 진행할 수 있는 플랫폼이다.

초기 유행 상품은 관리자가 등록하고, 이후에는 사용자 검색 로그와 키워드 매핑 데이터를 기반으로 유행 상품 순위를 산정한다.

## 2. 시스템 목적

```text
소비자
- 현재 위치 또는 검색 위치 기준으로 주변 매장의 유행 상품을 찾는다.
- 매장별 예약 가능 재고를 확인하고 상품을 예약한다.

판매자
- 매장 정보, 판매 상품, 재고, 예약 상태를 관리한다.
- 온라인 예약 가능 재고와 오프라인 판매량을 반영한다.

관리자
- 사용자, 판매자, 매장, 상품 카테고리, 키워드, 검색 로그를 관리한다.
- 미매핑 검색어를 검토하여 검색 품질과 유행 상품 데이터를 개선한다.
```

## 3. 사용자 역할 요구사항

### 3.1 소비자 User

소비자는 서비스를 이용해 유행 상품을 검색하고 예약하는 사용자이다.

주요 기능:

```text
- 소비자 역할 선택 및 로그인
- 현재 위치 기반 주변 매장 조회
- 검색어 기반 위치 + 상품 검색
- 카카오맵 기반 매장 위치 확인
- 지도 마커와 매장 카드 연동
- 매장별 상품 재고 확인
- 상품 예약
- 예약 취소
- 본인 예약 내역 조회
```

소비자 저장 정보:

```text
- 닉네임
- 기본 위치 또는 최근 위치
- 알림 수신 여부
```

### 3.2 판매자 Store Owner / Seller

판매자는 매장과 상품 재고를 관리하는 사용자이다.

주요 기능:

```text
- 판매자 역할 선택 및 로그인
- 매장 정보 등록 및 수정
- 판매 상품 등록
- 단일 대표 상품 이미지 등록
- 상품별 total_stock, reservable_stock 설정
- 예약 가능 재고 수정
- 예약 목록 확인
- 예약 승인
- 예약 취소
- 수령 완료 처리
- 오프라인 판매량 반영
```

판매자 저장 정보:

```text
- 사업자명
- 사업자등록번호
- 대표자명
- 연락처
- 판매자 승인 상태
- 매장 정보
```

### 3.3 관리자 Admin

관리자는 서비스 전체 데이터와 운영 정책을 관리하는 사용자이다.

주요 기능:

```text
- 관리자 역할 선택 및 로그인
- 사용자 계정 관리
- 판매자 승인 및 반려
- 매장 승인 및 반려
- 상품 카테고리 관리
- 유행 상품 기준 키워드 등록
- KeywordAlias 관리
- 미매핑 검색어 검토
- 미매핑 검색어를 기존 키워드 별칭으로 등록
- 미매핑 검색어를 신규 키워드로 생성
- 미매핑 검색어 보류 및 반려
- 미매핑 처리 취소
- 부적절한 상품 및 매장 데이터 관리
- 검색 로그 조회
- 유행 상품 순위 및 시스템 통계 확인
```

관리자 저장 정보:

```text
- 소속 부서
- 권한 등급
- 운영 권한
```

## 4. 현재 구현된 프론트엔드 화면

현재 프론트엔드는 React + Vite 기반이며, 역할별 화면을 라우팅으로 분리한다.

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
- 역할별 로그인 진입 화면

/consumer
- 소비자 메인 화면
- 카카오맵 표시
- 상품 검색
- 추천 유행 상품 표시
- 현재 위치 또는 검색 위치 기준 주변 매장 표시
- 지도 마커와 매장 카드 연동
- 선택 매장 정보 패널 지속 표시
- 예약 화면 이동

/consumer/reservations/new
- 상품 예약 화면
- 매장 정보, 상품 정보, 예약 가능 재고 표시
- 수량 입력
- 방문 예정 시간 입력
- 예약 가능 재고 초과 방지
- 방문 시간 최소 30분 이후 검증

/seller
- 판매자 메인 화면
- 매장 정보 확인
- 등록 상품 및 재고 확인
- 예약 가능 재고 수정
- 예약 승인 / 취소 / 수령 완료 처리
- 오프라인 판매량 반영

/seller/products/new
- 판매자 상품 등록 화면
- 상품명, 카테고리, 가격, 설명 입력
- 단일 대표 이미지 등록 및 정사각형 미리보기
- 초기 재고 및 예약 가능 재고 설정

/admin
- 관리자 데이터 관리 화면
- 키워드 관리
- 별칭 등록
- 새 키워드 생성
- 미매핑 검색어 검토
- 보류 / 반려 / 처리 취소
- 검색 로그 확인
```

## 5. 위치 기반 검색 요구사항

브라우저 Geolocation은 데스크톱 환경에서 실제 위치와 오차가 클 수 있으므로, 위치 기준은 다음 우선순위로 결정한다.

```text
1. 검색어 안에서 추출한 위치어
   예) 부평역 주변 버터떡, 성수역 두쫀쿠

2. 브라우저 Geolocation 또는 사용자 기본 위치
   예) lat/lng 파라미터

3. 서비스 기본 위치
   개발 초기 fallback 좌표
```

백엔드는 검색어에서 위치 의도와 상품 의도를 분리한다.

예시:

```text
입력: 부평역 주변 버터떡
위치 의도: 부평역
상품 의도: 버터떡
```

위치어는 Kakao Local REST API로 좌표 변환하고, 결과는 `location_cache`에 저장하여 반복 API 호출을 줄인다.

프론트엔드는 Kakao Map JavaScript API를 사용하여 매장 마커, 내 위치 또는 검색 기준 위치, 매장 카드를 표시한다.

## 6. 상품 이미지 관리 요구사항

상품 이미지는 단일 대표 이미지만 사용한다.

DB에는 이미지 파일 자체를 저장하지 않고 이미지 URL 또는 서버 파일 경로만 저장한다.

권장 컬럼:

```text
products.image_url
```

예시:

```text
/uploads/products/butter-rice-cake.jpg
```

이미지 업로드 흐름:

```text
1. 판매자가 상품 대표 이미지 업로드
2. 백엔드가 파일을 uploads 폴더 또는 정적 파일 저장소에 저장
3. DB에는 image_url만 저장
4. 프론트는 API 응답의 image_url을 이용해 이미지 표시
```

## 7. 재고 관리 요구사항

재고는 세 값으로 분리한다.

```text
total_stock
- 실제 매장 전체 재고

reservable_stock
- 온라인 예약 가능 재고

reserved_stock
- 이미 예약된 재고
```

재고 검증 규칙:

```text
- total_stock >= 0
- reservable_stock >= 0
- reserved_stock >= 0
- reservable_stock + reserved_stock <= total_stock
- reserved_stock은 판매자가 직접 수정하지 않는다.
```

예약 생성 시:

```text
reservable_stock 감소
reserved_stock 증가
reservation.status = PENDING
```

예약 취소 시:

```text
reserved_stock 감소
reservable_stock 증가
reservation.status = CANCELED
```

수령 완료 시:

```text
reserved_stock 감소
reservation.status = PICKED_UP
```

오프라인 판매 반영 시:

```text
total_stock 감소
reservable_stock 감소
reserved_stock은 변경하지 않음
```

## 8. 예약 병행제어 및 회복 요구사항

예약과 재고 변경은 데이터 정합성이 가장 중요한 기능이므로 반드시 트랜잭션으로 처리한다.

트랜잭션 필수 작업:

```text
- 예약 생성
- 예약 취소
- 판매자 예약 상태 변경
- 판매자 재고 수정
- 오프라인 판매량 반영
```

예약 생성 처리 원칙:

```text
1. START TRANSACTION
2. inventory 행 SELECT ... FOR UPDATE
3. reservable_stock >= quantity 검증
4. 조건부 UPDATE로 재고 차감
5. affectedRows 확인
6. reservations 생성
7. reservation_status_logs 기록
8. COMMIT
9. 실패 시 ROLLBACK
```

조건부 재고 차감 예시:

```sql
UPDATE inventories
SET reservable_stock = reservable_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE inventory_id = ?
  AND reservable_stock >= ?;
```

회복 요구사항:

```text
- 재고 변경과 예약 생성/상태 변경은 부분 반영되면 안 된다.
- 중간 실패 시 반드시 ROLLBACK한다.
- 예약 상태 변경 이력은 reservation_status_logs에 저장한다.
- 상태 로그는 장애 후 추적과 수동 복구 근거로 사용한다.
```

예약 상태 전이:

```text
PENDING -> APPROVED
PENDING -> CANCELED
APPROVED -> PICKED_UP
APPROVED -> CANCELED
```

최종 상태:

```text
CANCELED
PICKED_UP
```

최종 상태는 일반 사용자가 되돌릴 수 없다.

## 9. 검색어 및 유행 상품 관리 요구사항

사용자의 검색어를 그대로 유행 상품 기준 키워드로 사용하지 않는다. 검색어는 `KeywordAlias`를 통해 기준 키워드인 `Keyword`로 매핑한다.

예시:

```text
버터떡
버터 떡
버터떡 맛집
버터떡 파는곳
→ 기준 키워드: 버터떡
```

검색 처리 흐름:

```text
1. 사용자가 검색어 입력
2. 검색어 정규화
3. 위치 후보와 상품 키워드 후보 분리
4. 상품 키워드를 keyword_aliases.alias_normalized와 매칭
5. 매칭 성공 시 search_logs에 keyword_id와 함께 저장
6. 매칭 실패 시 unmapped_searches에 저장 또는 count 증가
7. 관리자 검토 후 별칭 등록, 새 키워드 생성, 보류, 반려 처리
```

새 기준 키워드 등록 제약:

```text
- 2자 이상 20자 이하
- 공백 금지
- 검색 의도 단어 금지
  예) 맛집, 예약, 파는곳, 추천, 근처, 요즘, 신상
- 기존 기준 키워드와 중복 금지
- 특정 상품을 대표하는 명사 중심으로 등록
```

미매핑 검색어 처리 결과:

```text
별칭 등록
- 기존 기준 키워드의 alias로 연결

새 키워드 생성
- 새로운 기준 키워드와 alias 생성

보류
- 판단 유예, 검색량 증가 또는 상품성 확인 후 재검토

반려
- 상품 키워드로 부적절하여 검토 흐름에서 제외

처리 취소
- 잘못 처리한 미매핑 검색어의 결과를 되돌림
```

## 10. 주요 데이터베이스 개체

핵심 테이블:

```text
users
consumer_profiles
seller_profiles
admin_profiles
stores
product_categories
products
inventories
reservations
reservation_status_logs
keywords
keyword_aliases
search_logs
unmapped_searches
location_cache
```

주요 관계:

```text
User 1:N Reservation
SellerProfile 1:N Store
Store 1:N Inventory
Product 1:N Inventory
Inventory 1:N Reservation
Keyword 1:N KeywordAlias
Keyword 1:N SearchLog
```

## 11. 주요 인덱스 요구사항

권장 인덱스:

```text
stores(latitude, longitude)
inventories(store_id, product_id) UNIQUE
reservations(user_id)
reservations(inventory_id, status)
reservation_status_logs(reservation_id, created_at)
keyword_aliases(alias_normalized) UNIQUE
search_logs(keyword_id, created_at)
unmapped_searches(raw_query_normalized) UNIQUE
location_cache(query_normalized) UNIQUE
```

성능 고려사항:

```text
- 검색어 매핑은 LIKE '%검색어%'보다 정규화된 alias exact match 우선
- Kakao Local REST API 결과는 location_cache에 저장
- 위치 기반 검색은 stores(latitude, longitude) 인덱스 활용
- 검색 로그는 초기 구현에서는 동기 INSERT 허용
```

## 12. API 요구사항 요약

프론트엔드와 연결할 핵심 API:

```text
GET /api/health
GET /api/products
GET /api/keywords/trending
GET /api/search?query=...&lat=...&lng=...
GET /api/stores/nearby
GET /api/stores/:storeId
GET /api/stores/:storeId/inventories
POST /api/reservations
GET /api/users/:userId/reservations
PATCH /api/reservations/:reservationId/cancel
POST /api/uploads/product-image
GET /api/seller/stores
PATCH /api/seller/stores/:storeId
POST /api/seller/products
GET /api/seller/stores/:storeId/products
PATCH /api/seller/inventories/:inventoryId
POST /api/seller/inventories/:inventoryId/offline-sales
GET /api/seller/reservations
PATCH /api/seller/reservations/:reservationId/status
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
GET /api/admin/search-summary
```

`GET /api/keywords/trending`은 특정 매장의 상품이 아니라 최근 검색 로그 기반 인기 Keyword를 반환한다. 기존 `GET /api/products/trending`은 호환용으로 유지할 수 있으나, 신규 화면에서는 Keyword 기준 랭킹을 사용한다.

## 13. 배포 및 발표 환경 요구사항

학교 발표 환경에서는 발표 PC에 MariaDB를 직접 설치하지 않고 AWS 기반 구조를 사용하는 방향을 고려한다.

권장 발표 구조:

```text
React 프론트엔드
  ↓
EC2 Node.js 백엔드
  ↓
RDS MariaDB
```

역할:

```text
EC2
- Node.js Express 백엔드 실행
- API 요청 처리
- RDS MariaDB 접속

RDS
- MariaDB 데이터베이스 실행
- 사용자, 매장, 상품, 재고, 예약, 검색 로그 저장

React
- 사용자 화면 제공
- 백엔드 API 호출
- DB에는 직접 접근하지 않음
```

보안 원칙:

```text
- 프론트엔드는 DB에 직접 접속하지 않는다.
- RDS 3306 포트는 EC2 보안 그룹에서만 접근 가능하게 제한한다.
- .env 파일과 DB 비밀번호는 GitHub에 올리지 않는다.
- GitHub에는 .env.example만 올린다.
```

## 14. 발표 시연 흐름

소비자 시연:

```text
1. 로그인 화면에서 소비자 선택
2. 소비자 메인 진입
3. "부평역 주변 버터떡" 또는 "강남역 두쫀쿠" 검색
4. 카카오맵에 기준 위치와 주변 매장 표시
5. 매장 카드 또는 지도 마커 선택
6. 매장별 상품과 예약 가능 재고 확인
7. 예약 화면 이동
8. 수량과 방문 시간 입력
9. 예약 완료
```

판매자 시연:

```text
1. 판매자 화면 진입
2. 매장 정보 확인
3. 등록 상품과 재고 확인
4. 예약 가능 재고 수정
5. 예약 승인 / 취소 / 수령 완료 처리
6. 오프라인 판매량 반영
```

관리자 시연:

```text
1. 관리자 화면 진입
2. 검색 로그 확인
3. 미매핑 검색어 확인
4. 기존 키워드 별칭으로 등록
5. 새 키워드 생성
6. 보류 / 반려 / 처리 취소 확인
7. 유행 상품 순위 관리 흐름 설명
```

발표 강조점:

```text
- React → Node.js API → MariaDB 구조
- 카카오맵 기반 위치 검색
- KeywordAlias 기반 검색어 정규화
- Inventory 기반 매장별 재고 관리
- 예약 트랜잭션과 행 잠금을 통한 병행제어
- ROLLBACK과 상태 로그를 통한 회복 가능성
```

## 15. 현재 구현 현황

프론트엔드 구현 완료 또는 초안 구현 항목:

```text
- 역할 선택 로그인 화면
- 소비자 메인 화면
- 카카오맵 JavaScript API 연동
- 지도 마커와 매장 카드 연동
- 선택 매장 정보 패널 유지
- 소비자 예약 화면
- 예약 수량 및 방문 시간 검증
- 판매자 메인 화면
- 판매자 상품 등록 화면
- 상품 대표 이미지 정사각형 미리보기
- 판매자 재고 및 예약 상태 관리 UI
- 관리자 키워드, 별칭, 미매핑 검색어 관리 UI
- 관리자 검색 로그 UI 보강
```

문서화 완료 항목:

```text
- API 명세서
- MariaDB 개발 가이드
- 카카오맵 설정 가이드
- DB 브랜치 리뷰 문서
- 최신 요구사항 명세서
```

DB 담당자 진행 항목:

```text
- feature/database-role-schema 브랜치에서 schema.sql, seed.sql 작성 진행
- 현재 최신 명세와 일부 차이가 있어 merge 전 보완 필요
```

## 16. 우선 구현 순서

남은 구현 추천 순서:

```text
1. DB schema.sql, seed.sql을 최신 명세와 맞춤
2. RDS 또는 로컬 MariaDB에서 schema.sql, seed.sql 실행 검증
3. 백엔드 MariaDB 연결 설정
4. GET /api/health 구현
5. GET /api/products/trending 구현
6. GET /api/search 구현
7. POST /api/reservations 트랜잭션 구현
8. 판매자 재고/예약 API 구현
9. 관리자 키워드/검색 로그 API 구현
10. 프론트 mock 데이터 제거 후 실제 API 연결
11. EC2/RDS 발표 환경 점검
```
