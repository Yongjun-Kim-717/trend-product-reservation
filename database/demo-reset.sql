USE trend_product_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reservation_status_logs;
TRUNCATE TABLE reservations;
TRUNCATE TABLE inventories;
TRUNCATE TABLE products;
TRUNCATE TABLE stores;
TRUNCATE TABLE location_cache;
TRUNCATE TABLE unmapped_searches;
TRUNCATE TABLE search_logs;
TRUNCATE TABLE keyword_aliases;
TRUNCATE TABLE keywords;
TRUNCATE TABLE product_categories;
TRUNCATE TABLE admin_profiles;
TRUNCATE TABLE seller_profiles;
TRUNCATE TABLE consumer_profiles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (user_id, role, login_id, password_hash, name, phone, status, created_at) VALUES
  (1, 'ADMIN', 'admin1', 'admin1234', '김관리', '010-0000-0001', 'ACTIVE', '2026-05-01 09:00:00'),
  (2, 'CONSUMER', 'consumer1', 'consumer1234', '이소비', '010-0000-0002', 'ACTIVE', '2026-05-01 09:10:00'),
  (3, 'SELLER', 'seller_ready', 'seller1234', '박판매', '010-0000-0003', 'ACTIVE', '2026-05-01 09:20:00'),
  (4, 'SELLER', 'seller_pending', 'seller1234', '최승인', '010-0000-0004', 'ACTIVE', '2026-05-01 09:30:00'),
  (5, 'CONSUMER', 'consumer_suspended', 'consumer1234', '정지유저', '010-0000-0005', 'SUSPENDED', '2026-05-01 09:40:00');

INSERT INTO admin_profiles (user_id, department, permission_level) VALUES
  (1, '서비스 운영팀', 'SUPER_ADMIN');

INSERT INTO consumer_profiles (user_id, nickname, default_latitude, default_longitude, notification_enabled) VALUES
  (2, '소비자데모', 37.4519000, 126.6544000, 1),
  (5, '정지계정', 37.4904000, 126.7248000, 0);

INSERT INTO seller_profiles
  (seller_id, user_id, business_name, business_registration_no, representative_name, contact_phone, approval_status, approved_at)
VALUES
  (1, 3, '박판매 디저트', '111-11-11111', '박판매', '010-0000-0003', 'APPROVED', '2026-05-01 10:00:00'),
  (2, 4, '최승인 팝업', '222-22-22222', '최승인', '010-0000-0004', 'PENDING', NULL);

INSERT INTO product_categories (category_id, name, status) VALUES
  (1, '디저트', 'ACTIVE'),
  (2, '베이커리', 'ACTIVE'),
  (3, '음료', 'ACTIVE'),
  (4, '간편식', 'ACTIVE'),
  (5, '굿즈', 'ACTIVE');

INSERT INTO stores
  (store_id, seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status, created_at)
VALUES
  (1, 1, '두쫀쿠마스터', '인천 미추홀구 인하로 77 인하대학교 후문 인근', 37.4519000, 126.6544000, '032-111-1001', '09:00~21:00', 'APPROVED', '2026-05-01 10:10:00'),
  (2, 1, '버터떡마스터', '인천 미추홀구 인하로 89', 37.4527000, 126.6551000, '032-111-1002', '10:00~20:00', 'APPROVED', '2026-05-01 10:20:00'),
  (3, 1, '승인대기 디저트샵', '인천 미추홀구 인하로 95', 37.4531000, 126.6558000, '032-111-1003', '11:00~19:00', 'PENDING', '2026-05-01 10:30:00');

INSERT INTO products
  (product_id, name, category_id, description, price, image_url, status, created_at)
VALUES
  (1, '두쫀쿠', 1, 'SNS에서 유행하는 쫀득한 쿠키 디저트', 4800, '/uploads/products/dozzonku-demo.png', 'ACTIVE', '2026-05-01 10:40:00'),
  (2, '버터떡', 1, '버터 향이 진한 예약 한정 떡 디저트', 5500, '/uploads/products/buttertteok-demo.png', 'ACTIVE', '2026-05-01 10:45:00'),
  (3, '소금빵', 2, '관리자 미매핑 처리 시연용 베이커리 상품', 3500, '/uploads/products/saltbread-demo.png', 'ACTIVE', '2026-05-01 10:50:00');

INSERT INTO inventories
  (inventory_id, store_id, product_id, total_stock, reservable_stock, reserved_stock, updated_at)
VALUES
  (1, 1, 1, 30, 12, 0, '2026-05-01 11:00:00'),
  (2, 2, 2, 25, 9, 0, '2026-05-01 11:05:00'),
  (3, 3, 3, 20, 8, 0, '2026-05-01 11:10:00');

INSERT INTO keywords (keyword_id, keyword_name, trend_score, status, updated_at) VALUES
  (1, '두쫀쿠', 85, 'ACTIVE', '2026-05-01 11:20:00'),
  (2, '버터떡', 72, 'ACTIVE', '2026-05-01 11:20:00'),
  (3, '소금빵', 28, 'ACTIVE', '2026-05-01 11:20:00');

INSERT INTO keyword_aliases (alias_id, keyword_id, alias, alias_normalized, created_at) VALUES
  (1, 1, '두쫀쿠', '두쫀쿠', '2026-05-01 11:25:00'),
  (2, 1, '두쫀쿠 맛집', '두쫀쿠맛집', '2026-05-01 11:25:00'),
  (3, 1, '쫀득쿠키', '쫀득쿠키', '2026-05-01 11:25:00'),
  (4, 2, '버터떡', '버터떡', '2026-05-01 11:25:00'),
  (5, 2, '버터떡 맛집', '버터떡맛집', '2026-05-01 11:25:00'),
  (6, 3, '소금빵', '소금빵', '2026-05-01 11:25:00');

INSERT INTO search_logs
  (log_id, user_id, keyword_id, raw_query, location_query, result_count, mapping_status, created_at)
VALUES
  (1, 2, 1, '인하대학교 후문 두쫀쿠', '인하대학교 후문', 1, 'MAPPED', DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (2, 2, 2, '인하대학교 후문 버터떡', '인하대학교 후문', 1, 'MAPPED', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (3, 2, 1, '인하대학교 후문 두쫀쿠', '인하대학교 후문', 1, 'MAPPED', DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (4, NULL, NULL, '인하대학교 후문 말차푸딩', '인하대학교 후문', 0, 'UNMAPPED', DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (5, 2, 2, '버터떡', '부평역', 1, 'MAPPED', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (6, 2, NULL, '평택대학교 근처 크림붕어빵', '평택대학교', 0, 'UNMAPPED', DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT INTO unmapped_searches
  (unmapped_id, raw_query, raw_query_normalized, count, status, resolved_action, resolution_note, created_at, last_seen_at)
VALUES
  (1, '말차푸딩', '말차푸딩', 4, 'PENDING', NULL, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (2, '크림붕어빵', '크림붕어빵', 2, 'PENDING', NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3, '인하대 후문 디저트 추천', '인하대후문디저트추천', 1, 'HOLD', NULL, '상품 대표명 여부 추가 확인', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT INTO location_cache
  (location_cache_id, query, query_normalized, latitude, longitude, source, created_at, updated_at)
VALUES
  (1, '인하대학교 후문', '인하대학교후문', 37.4519000, 126.6544000, 'MANUAL', '2026-05-01 11:30:00', '2026-05-01 11:30:00'),
  (2, '부평역', '부평역', 37.4904000, 126.7248000, 'MANUAL', '2026-05-01 11:30:00', '2026-05-01 11:30:00'),
  (3, '평택대학교', '평택대학교', 36.9948000, 127.1346000, 'MANUAL', '2026-05-01 11:30:00', '2026-05-01 11:30:00');

ALTER TABLE users AUTO_INCREMENT = 100;
ALTER TABLE seller_profiles AUTO_INCREMENT = 100;
ALTER TABLE product_categories AUTO_INCREMENT = 100;
ALTER TABLE stores AUTO_INCREMENT = 100;
ALTER TABLE products AUTO_INCREMENT = 100;
ALTER TABLE inventories AUTO_INCREMENT = 100;
ALTER TABLE reservations AUTO_INCREMENT = 100;
ALTER TABLE reservation_status_logs AUTO_INCREMENT = 100;
ALTER TABLE keywords AUTO_INCREMENT = 100;
ALTER TABLE keyword_aliases AUTO_INCREMENT = 100;
ALTER TABLE search_logs AUTO_INCREMENT = 100;
ALTER TABLE unmapped_searches AUTO_INCREMENT = 100;
ALTER TABLE location_cache AUTO_INCREMENT = 100;
