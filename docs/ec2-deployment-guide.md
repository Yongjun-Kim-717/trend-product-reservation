# EC2 배포 가이드

이 문서는 발표용 배포를 기준으로 한다. 비용과 운영 복잡도를 줄이기 위해 EC2 한 대에 React 정적 파일, Node.js 백엔드, MariaDB를 함께 배치한다.

## 1. 목표 구조

```text
외부 PC 브라우저
  -> EC2 Public IP 또는 도메인
  -> Nginx
     - /        : React dist 정적 파일
     - /api     : Node.js 백엔드 localhost:4000/api로 프록시
     - /uploads : Node.js 백엔드 localhost:4000/uploads로 프록시
  -> Node.js Express
  -> MariaDB localhost:3306
```

## 2. 상품 이미지 저장 위치

상품 대표 이미지는 DB에 바이너리로 저장하지 않는다. DB에는 `products.image_url` 문자열만 저장한다.

현재 백엔드는 업로드된 이미지를 다음 경로에 저장한다.

```text
backend/public/uploads/products
```

EC2에 배포하면 실제 저장 위치 예시는 다음과 같다.

```text
/home/ubuntu/trend-product-reservation/backend/public/uploads/products
```

프론트엔드는 DB의 `image_url` 값, 예를 들어 `/uploads/products/파일명.png`를 읽고, 백엔드 정적 파일 경로를 통해 이미지를 표시한다.

주의할 점:

- 업로드 이미지는 GitHub에 커밋하지 않는다.
- EC2에서 새로 업로드한 파일은 EC2 디스크에 남는다.
- EC2를 삭제하면 업로드 이미지도 사라진다.
- 발표용이면 EC2 로컬 디스크 저장으로 충분하다.
- 장기 운영 서비스라면 S3 같은 객체 스토리지로 분리하는 것이 맞다.

## 3. 환경변수 저장 위치

실제 키와 비밀번호는 GitHub에 올리지 않는다. `.env`, `backend/.env`, `frontend/.env`는 `.gitignore` 대상이다.

EC2에서는 다음처럼 저장한다.

```text
/home/ubuntu/trend-product-reservation/backend/.env
/home/ubuntu/trend-product-reservation/frontend/.env
```

백엔드 예시:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=trend_app
DB_PASSWORD=실제_DB_비밀번호
DB_NAME=trend_product_db
PORT=4000
KAKAO_REST_API_KEY=실제_KAKAO_REST_API_KEY
```

프론트엔드 예시:

```env
VITE_API_BASE_URL=http://EC2_PUBLIC_IP/api
VITE_KAKAO_JAVASCRIPT_KEY=실제_KAKAO_JAVASCRIPT_KEY
```

중요:

- `VITE_`로 시작하는 값은 프론트엔드 빌드 결과에 포함된다.
- Kakao JavaScript 키는 브라우저에서 사용되므로 공개될 수 있는 키다.
- Kakao REST API 키와 DB 비밀번호는 백엔드 `.env`에만 둔다.
- 프론트 `.env`를 수정하면 반드시 다시 빌드해야 한다.

## 4. EC2 생성

권장 설정:

- OS: Ubuntu 22.04 LTS 또는 24.04 LTS
- 인스턴스: 발표용이면 `t2.micro` 또는 `t3.micro`
- 보안 그룹 인바운드
  - SSH: `22`
  - HTTP: `80`
  - HTTPS: `443`은 선택
- MariaDB `3306`은 외부에 열지 않는다.

## 5. EC2 기본 패키지 설치

```bash
sudo apt update
sudo apt install -y git nginx mariadb-server
```

Node.js는 NodeSource 또는 nvm으로 설치한다. 발표용으로는 Node 20 이상을 권장한다.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

PM2 설치:

```bash
sudo npm install -g pm2
```

## 6. 프로젝트 배치

```bash
cd /home/ubuntu
git clone https://github.com/Yongjun-Kim-717/trend-product-reservation.git
cd trend-product-reservation
git checkout develop
npm install
```

## 7. MariaDB 설정

MariaDB 접속:

```bash
sudo mariadb
```

DB와 앱 계정 생성:

```sql
CREATE DATABASE IF NOT EXISTS trend_product_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'trend_app'@'localhost' IDENTIFIED BY '실제_DB_비밀번호';
GRANT ALL PRIVILEGES ON trend_product_db.* TO 'trend_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

스키마와 시연 데이터 적용:

```bash
mariadb -u trend_app -p trend_product_db < database/schema.sql
mariadb -u trend_app -p trend_product_db < database/demo-reset.sql
```

## 8. 환경변수 파일 작성

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

```bash
cp frontend/.env.example frontend/.env
nano frontend/.env
```

EC2 Public IP가 `1.2.3.4`라면 프론트엔드에는 다음처럼 설정한다.

```env
VITE_API_BASE_URL=http://1.2.3.4/api
VITE_KAKAO_JAVASCRIPT_KEY=실제_KAKAO_JAVASCRIPT_KEY
```

## 9. Kakao Developers 설정

Kakao Developers 콘솔에서 JavaScript SDK 도메인에 다음 값을 추가한다.

```text
http://EC2_PUBLIC_IP
```

도메인을 연결했다면 해당 도메인도 추가한다.

```text
http://your-domain.com
https://your-domain.com
```

Kakao REST API 키는 백엔드에서만 사용하므로 JavaScript SDK 도메인 설정과는 별개다.

## 10. 프론트엔드 빌드

```bash
npm run build --workspace frontend
```

빌드 결과:

```text
frontend/dist
```

## 11. 백엔드 PM2 실행

```bash
pm2 start npm --name trend-backend -- run start:backend
pm2 save
pm2 startup
```

상태 확인:

```bash
pm2 status
pm2 logs trend-backend
```

## 12. Nginx 설정

새 설정 파일 작성:

```bash
sudo nano /etc/nginx/sites-available/trend-product-reservation
```

내용:

```nginx
server {
    listen 80;
    server_name _;

    root /home/ubuntu/trend-product-reservation/frontend/dist;
    index index.html;

    client_max_body_size 8m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

활성화:

```bash
sudo ln -s /etc/nginx/sites-available/trend-product-reservation /etc/nginx/sites-enabled/trend-product-reservation
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 13. 외부 PC 테스트

브라우저에서 접속:

```text
http://EC2_PUBLIC_IP
```

확인 순서:

1. `admin1 / admin1234` 로그인
2. 판매자 승인 탭 확인
3. 매장 승인 탭 확인
4. `consumer1 / consumer1234` 로그인
5. `인하대학교 후문 두쫀쿠` 검색
6. 예약 생성
7. `seller_ready / seller1234` 로그인
8. 예약 승인/수령 완료 처리
9. 관리자 검색 로그 확인

## 14. 발표 직전 DB 초기화

발표 직전에 시연 데이터를 원래 상태로 되돌리려면 EC2에서 다음을 실행한다.

```bash
cd /home/ubuntu/trend-product-reservation
mariadb -u trend_app -p trend_product_db < database/demo-reset.sql
pm2 restart trend-backend
```

## 15. 자주 생기는 문제

### Kakao Map이 뜨지 않음

- Kakao Developers JavaScript SDK 도메인에 `http://EC2_PUBLIC_IP`가 등록되어 있는지 확인한다.
- 프론트엔드 `.env` 수정 후 다시 빌드했는지 확인한다.

### API 요청 실패

- `VITE_API_BASE_URL`이 `http://EC2_PUBLIC_IP/api`인지 확인한다.
- Nginx `/api/` 프록시 설정을 확인한다.
- `pm2 logs trend-backend`로 백엔드 오류를 확인한다.

### 이미지가 보이지 않음

- 실제 업로드 파일은 `backend/public/uploads/products`에 저장된다.
- Nginx `/uploads/`가 백엔드로 프록시되는지 확인한다.
- 현재 백엔드는 파일이 없어도 fallback SVG를 반환한다.

### DB 접속 실패

- `backend/.env`의 DB 계정과 비밀번호를 확인한다.
- MariaDB가 실행 중인지 확인한다.

```bash
sudo systemctl status mariadb
```
