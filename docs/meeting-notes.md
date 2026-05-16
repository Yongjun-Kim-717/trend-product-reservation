# Meeting Notes

## 2026-05-16

### 결정 사항

- 기술 스택: React, Node.js, Express, MariaDB
- 지도 API: Kakao Map API
- 핵심 기능: 상품 검색, 주변 매장 조회, 재고 확인, 예약
- 재고 컬럼: `total_stock`, `reservable_stock`, `reserved_stock`
- 예약은 트랜잭션 기반으로 처리

### 다음 작업

- DB 담당: `schema.sql`, `seed.sql` 검토
- 백엔드 담당: 상품/매장/예약 API 확장
- 프론트 담당: 검색/지도/예약 화면 구현
- 문서 담당: API 명세와 ERD 설명 보강
