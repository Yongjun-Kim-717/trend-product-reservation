# Git Workflow

## 최초 세팅

```bash
git clone https://github.com/Yongjun-Kim-717/trend-product-reservation.git
cd trend-product-reservation
git checkout develop
```

## 기능 작업

```bash
git checkout develop
git pull origin develop
git checkout -b feature/기능명
```

예시:

```bash
git checkout -b feature/database-schema
git checkout -b feature/backend-reservation
git checkout -b feature/frontend-map
```

## 작업 업로드

```bash
git add .
git commit -m "feat: add reservation api"
git push origin feature/기능명
```

GitHub에서 Pull Request를 생성합니다.

- base: `develop`
- compare: `feature/기능명`

## 규칙

- `main` 직접 push 금지
- 기능 작업은 `feature/*` 브랜치에서 진행
- Pull Request 제목은 변경 내용을 짧게 작성
- 충돌이 나면 혼자 해결하지 말고 팀에 공유
