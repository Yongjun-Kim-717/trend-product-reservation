USE trend_product_db;


/* =========================
   1. USERS
========================= */
INSERT INTO users (role, login_id, password_hash, name, phone) VALUES
('ADMIN', 'admin1', 'pw_11', '김용준', '010-3333-3333'),

('CONSUMER', 'consumer1', 'pw_1', '강태민', '010-1111-1111'),
('CONSUMER', 'consumer2', 'pw_2', '이서준', '010-1111-2222'),
('CONSUMER', 'consumer3', 'pw_3', '박지민', '010-1111-3333'),

('SELLER', 'seller1', 'pw_6', '임유섭', '010-2222-2222'),
('SELLER', 'seller2', 'pw_7', '김도윤', '010-2222-3333'),
('SELLER', 'seller3', 'pw_8', '한지훈', '010-2222-4444');


/* =========================
   2. CONSUMER PROFILES
========================= */
INSERT INTO consumer_profiles (user_id, nickname, default_latitude, default_longitude, notification_enabled) VALUES
(2, '두쫀쿠먹는다', 37.5665, 126.9780, TRUE),
(3, '버터떡123', 37.5650, 126.9820, TRUE),
(4, '두쫀쿠사랑해', 37.5640, 126.9770, TRUE);


/* =========================
   3. SELLER PROFILES
========================= */
INSERT INTO seller_profiles (user_id, business_name, business_registration_no, representative_name, contact_phone, approval_status, approved_at) VALUES
(5, '두쫀쿠 카페', '111-11-11111', '임유섭', '02-1111-1111', 'APPROVED', NOW()),
(6, '버터떡 하우스', '222-22-22222', '김도윤', '02-2222-2222', 'APPROVED', NOW()),
(7, '루나 카페', '333-33-33333', '한지훈', '02-3333-3333', 'PENDING', NULL);


/* =========================
   4. ADMIN PROFILE
========================= */
INSERT INTO admin_profiles (user_id, department, permission_level) VALUES
(1, 'SERVICE', 'SUPER_ADMIN');


/* =========================
   5. STORES
========================= */
INSERT INTO stores (seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status) VALUES
(1, '강남 두쫀쿠 카페 본점', '서울 강남구 테헤란로 1', 37.4980, 127.0276, '02-1111-0001', '09:00-21:00', 'APPROVED'),
(1, '강남 두쫀쿠 카페 2호점', '서울 강남구 역삼동 2', 37.4990, 127.0280, '02-1111-0002', '09:00-21:00', 'APPROVED'),
(2, '홍대 버터떡', '서울 마포구 홍익로 10', 37.5563, 126.9220, '02-2222-0001', '10:00-22:00', 'APPROVED'),
(3, '루나 카페', '서울 성동구 성수동 55', 37.5500, 127.0400, '02-3333-0001', '08:00-23:00', 'PENDING'); --미승인


/* =========================
   6. PRODUCT CATEGORIES
========================= */
INSERT INTO product_categories (name, status) VALUES
('디저트', 'ACTIVE'),
('음료', 'ACTIVE'),
('베이커리', 'ACTIVE');


/* =========================
   7. PRODUCTS
========================= */
INSERT INTO products (name, category_id, description, price, image_url, status) VALUES
('두쫀쿠', 1, '바삭쫀득 두쫀쿠', 3500, '/uploads/dzonku.jpg', 'ACTIVE'),
('버터떡', 1, '진한 버터 풍미 버터떡', 3000, '/uploads/butter.jpg', 'ACTIVE'),
('아메리카노', 2, '기본 커피', 2500, '/uploads/americano.jpg', 'ACTIVE'),
('카페라떼', 2, '부드러운 라떼', 3000, '/uploads/latte.jpg', 'ACTIVE'),
('딸기케이크', 1, '생크림 케이크', 5500, '/uploads/cake.jpg', 'ACTIVE'),
('초코쿠키', 1, '달달바삭 쿠키', 2800, '/uploads/cookie.jpg', 'ACTIVE');


/* =========================
   8. INVENTORIES
========================= */
INSERT INTO inventories (store_id, product_id, total_stock, reservable_stock, reserved_stock) VALUES

-- 두쫀쿠 카페 강남 본점
(1, 1, 100, 60, 10),
(1, 3, 80, 50, 5),
(1, 5, 60, 20, 15),
(1, 6, 90, 70, 5),

-- 두쫀쿠 카페 2호점
(2, 1, 40, 20, 5),
(2, 2, 30, 15, 3),
(2, 4, 50, 30, 10),

-- 홍대 버터떡
(3, 2, 120, 80, 10),
(3, 5, 70, 40, 5),
(3, 6, 60, 30, 10);


/* =========================
   9. RESERVATIONS
========================= */
INSERT INTO reservations (user_id, inventory_id, quantity, status, visit_time, request_note) VALUES
(2, 1, 2, 'PENDING', NOW(), '픽업 예정'),
(3, 4, 1, 'APPROVED', NOW(), '빠르게 부탁'),
(4, 8, 3, 'CANCELED', NOW(), '취소 요청');


/* =========================
   10. KEYWORDS
========================= */
INSERT INTO keywords (keyword_name, trend_score, status) VALUES
('두쫀쿠', 100, 'ACTIVE'),
('버터떡', 90, 'ACTIVE'),
('아메리카노', 120, 'ACTIVE');


/* =========================
   11. KEYWORD ALIASES
========================= */
INSERT INTO keyword_aliases (keyword_id, alias) VALUES
(1, '두바이쫀득쿠키'),
(1, '두바이 쫀득 쿠키'),
(1, '두존쿠'),
(1, 'ㄷㅉㅋ'),
(1, 'enWhszn'),
(1, 'dzonku'),
(2, '버터'),
(2, 'butter'),
(2, 'qjxjEjr'),
(3, '아아'),
(3, 'dkdk'),
(3, 'dkapflzksh'),
(3, '아이스커피');


/* =========================
   12. SEARCH LOGS
========================= */
INSERT INTO search_logs (user_id, keyword_id, raw_query) VALUES
(2, 1, '두쫀쿠'),
(3, 2, '버터떡'),
(2, NULL, '크로플');


/* =========================
   13. UNMAPPED SEARCHES
========================= */
INSERT INTO unmapped_searches (raw_query, count) VALUES
('크로플', 5),
('흑당버블티', 3);
-- Seed data intentionally left empty.
-- Add team-approved sample data here after the final schema and role-based user model are confirmed.
