# ERD Notes

## 주요 개체

- User
- Store
- Product
- Inventory
- Reservation
- Keyword
- KeywordAlias
- SearchLog
- UnmappedSearch

## 핵심 관계

- 한 사용자는 여러 예약을 생성할 수 있다.
- 한 매장은 여러 재고를 가진다.
- 한 상품은 여러 매장의 재고에 포함될 수 있다.
- 매장과 상품은 `Inventory`를 통해 N:M 관계를 가진다.
- 한 키워드는 여러 별칭을 가진다.
- 검색 로그는 가능하면 기준 키워드와 연결된다.

## 보정 사항

예약은 `store_id`, `product_id`만 직접 참조하는 대신 `inventory_id`를 함께 저장한다. 실제 예약 재고 단위가 `Inventory`이므로, 예약 트랜잭션은 `inventory_id` 기준으로 처리한다.
