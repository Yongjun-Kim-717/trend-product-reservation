# 발표자용 시연 순서표

최종 수정일: 2026-05-22

이 문서는 발표 중 옆에 띄워두고 따라가기 위한 짧은 진행표이다. 자세한 검증 항목은 `docs/demo-checklist.md`를 기준으로 한다.

## 1. 발표 전 3분 점검

EC2 접속 URL:

```text
http://13.220.26.183/
```

EC2 상태 확인:

```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status mariadb
curl http://localhost:4000/api/health
```

브라우저 준비:

- 탭 1: 소비자
- 탭 2: 판매자
- 탭 3: 관리자
- 필요 시 DB 확인용 HeidiSQL 또는 MariaDB CLI

시연 계정:

| 역할 | 아이디 | 비밀번호 |
| --- | --- | --- |
| 소비자 | `consumer1` | `consumer1234` |
| 판매자 | `seller_ready` | `seller1234` |
| 관리자 | `admin1` | `admin1234` |

## 2. 오프닝 설명

짧은 설명:

```text
이 시스템은 사용자가 유행 상품을 검색하면 검색어의 장소와 상품 의도를 분리하고, 카카오맵과 MariaDB의 매장/재고 데이터를 연결해 주변 매장을 찾고 예약까지 할 수 있는 서비스입니다.
```

구조 설명:

```text
React 프론트엔드
-> Node.js/Express API
-> MariaDB
-> Kakao Map JavaScript API / Kakao Local REST API
```

강조 포인트:

- DB 중심 설계
- 역할별 사용자 분리
- 매장별 재고 관리
- 예약 트랜잭션
- 검색 로그 기반 키워드 관리
- JWT 기반 인증과 역할별 API 권한 검증

## 3. 로그인/JWT 시연

진행:

1. 같은 브라우저에서 탭 3개를 연다.
2. 탭별로 각각 로그인한다.
   - 소비자: `consumer1`
   - 판매자: `seller_ready`
   - 관리자: `admin1`
3. 각 탭의 화면이 서로 바뀌지 않는지 보여준다.

설명 멘트:

```text
로그인 성공 시 백엔드가 JWT를 발급하고, 프론트는 토큰을 탭별 sessionStorage에 저장합니다. 그래서 같은 브라우저에서도 소비자, 판매자, 관리자 계정을 동시에 유지할 수 있습니다. 백엔드는 API 요청마다 Authorization 헤더의 토큰을 검증하고 role에 따라 접근을 제한합니다.
```

## 4. 관리자 승인 흐름

관리자 탭:

1. `판매자 승인` 탭을 연다.
2. 승인 대기 판매자 목록을 보여준다.
3. 필요 시 승인/반려 버튼 설명만 한다.
4. `매장 승인` 탭을 연다.
5. 승인 대기 매장이 소비자 검색에 바로 노출되지 않는다는 점을 설명한다.

설명 멘트:

```text
판매자 계정과 매장은 각각 승인 상태를 가집니다. 소비자 검색 결과에는 승인된 매장만 노출되므로 운영자가 부적절한 매장 데이터를 통제할 수 있습니다.
```

## 5. 판매자 매장/상품/재고 흐름

판매자 탭:

1. 판매자 메인으로 이동한다.
2. 매장 목록을 보여준다.
3. 등록 상품 및 재고 테이블을 보여준다.
4. `total_stock`, `reservable_stock`, `reserved_stock`을 설명한다.
5. 재고 숫자를 바꾸고 저장 버튼으로 반영하는 구조를 보여준다.
6. 상품 등록/수정 버튼 위치를 보여준다.

설명 멘트:

```text
Store와 Product는 Inventory를 통해 연결됩니다. Inventory는 단순 연결 테이블이 아니라 매장별 전체 재고, 예약 가능 재고, 예약된 재고를 관리하는 핵심 테이블입니다.
```

재고 설명:

```text
total_stock: 실제 매장 보유 재고
reservable_stock: 온라인 예약 가능 재고
reserved_stock: 이미 예약된 재고
```

## 6. 소비자 검색 흐름

소비자 탭:

1. 소비자 메인 화면으로 이동한다.
2. 카카오맵이 표시되는지 확인한다.
3. 검색창에 입력한다.

추천 검색어:

```text
인하대학교 후문 두쫀쿠
```

4. 검색 결과 매장과 지도 마커를 확인한다.
5. 매장 카드를 클릭해 지도 패널이 유지되는지 보여준다.
6. `가게 정보` 화면으로 이동한다.

설명 멘트:

```text
검색어에서 두쫀쿠는 상품 키워드로, 인하대학교 후문은 장소 후보로 분리됩니다. 장소 후보는 Kakao Local REST API로 좌표 변환하고, DB에서는 해당 좌표 주변의 승인 매장과 예약 가능 재고를 조회합니다.
```

## 7. 소비자 예약 흐름

소비자 탭:

1. 검색 결과에서 `이 매장에서 예약하기`를 누른다.
2. 예약 가능 재고를 확인한다.
3. 방문 예정 시간을 영업시간 안으로 선택한다.
4. 수량을 선택한다.
5. 예약을 생성한다.
6. `내 예약 보기`로 이동한다.

설명 멘트:

```text
예약 생성 시 백엔드는 Inventory 행을 잠그고 예약 가능 재고를 확인한 뒤, 재고 차감과 예약 생성을 하나의 트랜잭션으로 처리합니다. 따라서 동시에 여러 사용자가 예약해도 재고가 음수가 되지 않습니다.
```

## 8. 판매자 예약 처리 흐름

판매자 탭:

1. 판매자 메인 예약 목록으로 이동한다.
2. 방금 생성한 예약을 확인한다.
3. `예약 승인`을 누른다.
4. 필요 시 `수령 완료` 또는 `예약 취소`를 보여준다.

설명 멘트:

```text
예약 상태는 PENDING, APPROVED, CANCELED, PICKED_UP으로 관리됩니다. 상태 변경은 reservation_status_logs에 기록되어 이후 감사 로그와 회복 근거로 사용할 수 있습니다.
```

## 9. 관리자 검색 로그/미매핑 흐름

관리자 탭:

1. `검색 로그` 탭을 연다.
2. 방금 검색한 원본 검색어, 기준 키워드, 검색 기준 위치, 결과 수를 보여준다.
3. `미매핑 검색어` 탭을 연다.
4. 미매핑 검색어를 선택한다.
5. 기존 키워드 별칭 등록 또는 새 키워드 생성 흐름을 설명한다.

설명 멘트:

```text
사용자 검색어를 그대로 통계에 쓰지 않고 KeywordAlias를 통해 기준 키워드로 정규화합니다. 매핑 실패 검색어는 UnmappedSearch에 쌓이고, 관리자가 검토해 별칭 등록이나 새 키워드 생성을 할 수 있습니다.
```

## 10. DB 확인용 쿼리

예약 확인:

```sql
SELECT reservation_id, user_id, inventory_id, quantity, status, visit_time, created_at
FROM reservations
ORDER BY reservation_id DESC;
```

재고 확인:

```sql
SELECT inventory_id, store_id, product_id, total_stock, reservable_stock, reserved_stock
FROM inventories
ORDER BY inventory_id;
```

예약 상태 로그 확인:

```sql
SELECT log_id, reservation_id, previous_status, new_status, changed_by_user_id, changed_by_role, created_at
FROM reservation_status_logs
ORDER BY log_id DESC;
```

검색 로그 확인:

```sql
SELECT log_id, user_id, keyword_id, raw_query, location_query, result_count, mapping_status, created_at
FROM search_logs
ORDER BY log_id DESC;
```

## 11. 마무리 멘트

```text
이 프로젝트는 단순히 지도를 띄우는 서비스가 아니라, 사용자 역할별 데이터 관리, 위치 기반 검색, 매장별 재고 분리, 예약 트랜잭션, 검색 로그 기반 키워드 관리까지 하나의 데이터베이스 흐름으로 연결한 시스템입니다.
```

추가 강조:

- Kakao API는 위치 좌표와 지도 표시를 담당한다.
- 실제 매장, 상품, 재고, 예약, 검색 로그의 기준 데이터는 MariaDB가 관리한다.
- 예약 기능은 트랜잭션과 행 잠금을 통해 정합성을 보장한다.
- JWT를 통해 역할별 API 접근을 제한한다.

## 12. 문제 발생 시 빠른 대응

지도 오류:

```text
Kakao Developers JavaScript SDK 도메인 확인
http://13.220.26.183 등록 여부 확인
```

로그인 오류:

```text
시연 계정 비밀번호 확인
JWT_SECRET이 EC2 backend/.env에 있는지 확인
pm2 restart trend-backend --update-env
```

서버 오류:

```bash
pm2 logs trend-backend --lines 50
sudo tail -n 50 /var/log/nginx/error.log
```

DB 오류:

```bash
sudo systemctl status mariadb
curl http://localhost:4000/api/health
```

