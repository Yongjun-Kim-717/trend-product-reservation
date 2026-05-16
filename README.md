# Trend Product Reservation

사용자 위치 기반으로 주변 매장의 유행 상품을 탐색하고, 상품 재고 확인 및 예약을 제공하는 데이터베이스 팀 프로젝트입니다.

## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express
- Database: MariaDB
- Map API: Kakao Map API

## Project Structure

```text
frontend/   React 클라이언트
backend/    Node.js Express API 서버
database/   MariaDB schema, seed SQL
docs/       요구사항, API 명세, ERD, Git 작업 규칙
```

## Main Features

- 유행 상품 검색
- 카카오맵 기반 주변 매장 확인
- 매장별 상품 재고 조회
- 예약 가능 재고 기반 상품 예약
- 매장 관리자 재고 수정
- 검색어 별칭 및 미매핑 검색어 관리

## Branch Rule

- `main`: 최종 제출용 안정 버전
- `develop`: 개발 통합 브랜치
- `feature/*`: 기능별 작업 브랜치

`main`에는 직접 push하지 않고, 기능 작업은 `feature/*` 브랜치에서 진행한 뒤 Pull Request로 `develop`에 병합합니다.

## Local Setup

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

MariaDB는 로컬 설치 또는 `docker-compose.yml`을 이용해 실행할 수 있습니다.

```bash
docker compose up -d
```

환경 변수는 `.env.example`을 복사해 각자 `.env`로 작성합니다.
