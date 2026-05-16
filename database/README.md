# Database

## 실행 순서

1. MariaDB 서버 실행
2. `schema.sql` 실행
3. `seed.sql` 실행

Docker를 사용하는 경우 루트에서 다음 명령을 실행합니다.

```bash
docker compose up -d
```

## 핵심 설계

- `stores`와 `products`는 `inventories`를 통해 N:M 관계입니다.
- 예약은 `inventory_id` 기준으로 생성합니다.
- 예약 생성 시 `SELECT ... FOR UPDATE`로 해당 재고 행을 잠급니다.
- 재고는 `total_stock`, `reservable_stock`, `reserved_stock`으로 분리합니다.
