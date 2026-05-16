USE trend_product_db;

INSERT INTO users (nickname) VALUES
  ('테스트사용자'),
  ('매장관리자');

INSERT INTO stores (name, address, latitude, longitude) VALUES
  ('성수 디저트마켓', '서울 성동구 성수이로 10', 37.5445810, 127.0559610),
  ('홍대 트렌드스낵', '서울 마포구 와우산로 29', 37.5551730, 126.9236390),
  ('강남 핫딜스토어', '서울 강남구 강남대로 396', 37.4979520, 127.0276190);

INSERT INTO products (name, description) VALUES
  ('버터떡', 'SNS에서 유행하는 고소한 버터 풍미 디저트'),
  ('두쫀쿠', '쫀득한 식감의 인기 쿠키류 상품'),
  ('약과쿠키', '약과와 쿠키를 결합한 트렌드 상품');

INSERT INTO keywords (keyword_name, trend_score, status) VALUES
  ('버터떡', 95, 'ACTIVE'),
  ('두쫀쿠', 88, 'ACTIVE'),
  ('약과쿠키', 80, 'ACTIVE');

INSERT INTO keyword_aliases (keyword_id, alias) VALUES
  (1, '버터떡'),
  (1, '버터 떡'),
  (1, '버터떡 맛집'),
  (2, '두쫀쿠'),
  (2, '두쫀쿠키'),
  (3, '약과쿠키'),
  (3, '약과 쿠키');

INSERT INTO inventories (store_id, product_id, total_stock, reservable_stock, reserved_stock) VALUES
  (1, 1, 30, 20, 0),
  (1, 2, 15, 10, 0),
  (2, 1, 20, 12, 0),
  (2, 3, 25, 18, 0),
  (3, 2, 40, 25, 0),
  (3, 3, 18, 8, 0);
