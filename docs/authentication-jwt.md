# JWT 인증 설계 문서

최종 수정일: 2026-05-22

## 1. 문서 목적

이 문서는 트렌드 상품 예약 시스템의 로그인 인증 방식과 역할별 권한 검증 구조를 설명한다. 기존 프론트 저장소 기반 사용자 판별 방식의 한계를 보완하고, 발표 시 소비자/판매자/관리자 계정을 같은 브라우저에서 동시에 시연할 수 있도록 JWT 기반 인증 구조를 적용했다.

## 2. 기존 방식의 문제점

초기 구현에서는 로그인 성공 후 사용자 정보를 브라우저 `localStorage`에 저장했다.

```text
trend_product_current_user = {
  user_id,
  role,
  login_id,
  name,
  status
}
```

이 방식의 문제:

- `localStorage`는 같은 도메인의 모든 탭이 공유한다.
- 같은 브라우저에서 소비자, 판매자, 관리자 탭을 동시에 열면 마지막 로그인 계정이 전체 탭의 로그인 상태를 덮어쓴다.
- 프론트가 API 요청에 `user_id`, `seller_id`, `admin_user_id`를 직접 전달하는 구조라 조작 가능성이 있다.
- 백엔드가 요청마다 사용자 권한을 충분히 검증하지 못한다.

따라서 발표 시 다음 흐름이 불안정했다.

```text
탭 1: 소비자 로그인
탭 2: 판매자 로그인
탭 3: 관리자 로그인
```

## 3. 최종 인증 방식

최종 구조는 다음과 같다.

```text
JWT 기반 인증 + 탭별 sessionStorage 저장
```

핵심 특징:

- 로그인 성공 시 백엔드가 JWT를 발급한다.
- 프론트엔드는 JWT를 `sessionStorage`에 저장한다.
- API 요청마다 `Authorization: Bearer <token>` 헤더를 보낸다.
- 백엔드는 JWT 서명을 검증하고, 토큰의 `user_id`, `role`을 기준으로 권한을 판단한다.
- 같은 브라우저에서도 탭마다 다른 `sessionStorage`를 가지므로 세 역할을 동시에 시연할 수 있다.

## 4. JWT 기본 개념

JWT는 JSON Web Token의 약자이며, 서버가 발급하는 서명된 토큰이다.

JWT는 보통 다음 3부분으로 구성된다.

```text
Header.Payload.Signature
```

각 부분의 역할:

| 구성 요소 | 설명 |
| --- | --- |
| Header | 토큰 타입과 서명 알고리즘 정보 |
| Payload | 사용자 식별 정보, 역할, 만료 시간 등 |
| Signature | 서버의 비밀키로 만든 위조 방지 서명 |

중요한 점:

- JWT는 기본적으로 암호화가 아니라 서명 방식이다.
- Payload 내용은 디코딩될 수 있으므로 비밀번호 같은 민감 정보는 넣지 않는다.
- 서버의 `JWT_SECRET`을 모르면 유효한 Signature를 만들 수 없기 때문에 토큰 위조를 막을 수 있다.
- `JWT_SECRET`은 반드시 백엔드 `.env`에 설정해야 하며, 값이 없으면 서버가 시작되지 않는다.

## 5. 로그인 처리 흐름

### 5.1 로그인 요청

사용자가 로그인 화면에서 아이디와 비밀번호를 입력한다.

예시:

```text
consumer1 / consumer1234
```

프론트엔드는 백엔드에 로그인 요청을 보낸다.

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "login_id": "consumer1",
  "password": "consumer1234"
}
```

### 5.2 사용자 검증

백엔드는 `users` 테이블에서 `login_id`를 조회한다.

검증 항목:

- 아이디 존재 여부
- 비밀번호 일치 여부
- 계정 상태가 `SUSPENDED`인지 여부

시연용 DB에서는 `password_hash`에 평문 시연 비밀번호를 저장하고 비교한다. 운영 수준에서는 bcrypt 또는 argon2 같은 단방향 해시를 사용해야 한다.

### 5.3 JWT 발급

로그인 검증에 성공하면 백엔드는 JWT를 발급한다.

토큰 Payload 예시:

```json
{
  "user_id": 2,
  "role": "CONSUMER",
  "login_id": "consumer1",
  "name": "강태민",
  "status": "ACTIVE",
  "iat": 1779400000,
  "exp": 1779428800
}
```

서버는 이 Payload를 `JWT_SECRET`으로 서명한다.

응답 예시:

```json
{
  "data": {
    "user": {
      "user_id": 2,
      "role": "CONSUMER",
      "login_id": "consumer1",
      "name": "강태민",
      "status": "ACTIVE"
    },
    "session": {
      "token": "eyJhbGciOi...",
      "token_type": "Bearer",
      "expires_in": "8h"
    }
  },
  "message": "success"
}
```

## 6. 프론트엔드 저장 방식

프론트엔드는 로그인 성공 후 다음 정보를 `sessionStorage`에 저장한다.

```text
trend_product_current_user
trend_product_auth_session
```

저장 구조:

```json
{
  "user": {
    "user_id": 2,
    "role": "CONSUMER",
    "login_id": "consumer1",
    "name": "강태민",
    "status": "ACTIVE"
  },
  "session": {
    "token": "eyJhbGciOi...",
    "token_type": "Bearer",
    "expires_in": "8h"
  }
}
```

### 6.1 sessionStorage를 사용하는 이유

`localStorage`와 `sessionStorage`의 차이는 다음과 같다.

| 저장소 | 특징 | 시연 영향 |
| --- | --- | --- |
| localStorage | 같은 도메인의 모든 탭이 공유 | 한 탭에서 로그인하면 다른 탭도 같은 계정으로 바뀜 |
| sessionStorage | 탭 단위로 분리 | 같은 브라우저에서 소비자/판매자/관리자 동시 로그인 가능 |

따라서 시연에서는 다음 구성이 가능하다.

```text
탭 1: consumer1 JWT
탭 2: seller_ready JWT
탭 3: admin1 JWT
```

## 7. API 요청 흐름

프론트엔드 공통 API 클라이언트는 요청 전에 `sessionStorage`에서 JWT를 읽는다.

토큰이 있으면 모든 API 요청에 다음 헤더를 붙인다.

```http
Authorization: Bearer <jwt-token>
```

예시:

```http
POST /api/reservations
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

백엔드는 이 헤더를 통해 사용자를 식별한다.

## 8. 백엔드 인증 미들웨어

백엔드는 인증이 필요한 API에서 다음 단계를 수행한다.

1. `Authorization` 헤더를 읽는다.
2. `Bearer` 토큰을 추출한다.
3. `JWT_SECRET`으로 토큰 서명을 검증한다.
4. 토큰이 만료되었는지 확인한다.
5. 토큰의 `user_id`로 DB의 `users` 테이블을 다시 조회한다.
6. 사용자 상태가 `ACTIVE`인지 확인한다.
7. 검증된 사용자 정보를 `req.user`에 저장한다.

토큰이 없거나 유효하지 않으면:

```http
401 Unauthorized
```

계정이 정지되었거나 사용할 수 없으면:

```http
403 Forbidden
```

## 9. 인증과 인가

본 시스템은 인증과 인가를 구분한다.

```text
인증(Authentication): 사용자가 누구인지 확인하는 과정
인가(Authorization): 해당 사용자가 이 기능을 사용할 수 있는지 확인하는 과정
```

JWT 검증은 인증에 해당한다.

역할별 API 접근 검사는 인가에 해당한다.

## 10. 역할별 접근 정책

역할별 API 접근 규칙:

| API 범위 | 필요 역할 |
| --- | --- |
| `/api/admin/*` | `ADMIN` |
| `/api/seller/*` | `SELLER` |
| `POST /api/uploads/products` | `SELLER` |
| `POST /api/reservations` | `CONSUMER` |
| `GET /api/users/:userId/reservations` | `CONSUMER` |
| `PATCH /api/reservations/:reservationId/cancel` | `CONSUMER` |

예시:

- 소비자 토큰으로 관리자 API 호출: 거부
- 판매자 토큰으로 소비자 예약 생성: 거부
- 관리자 토큰으로 판매자 재고 수정: 거부

## 11. user_id 조작 방지

기존 방식에서는 프론트엔드가 API 요청 본문이나 쿼리에 `user_id`, `seller_id`, `admin_user_id`를 직접 전달했다.

문제 예시:

```json
{
  "user_id": 999,
  "inventory_id": 1,
  "quantity": 1
}
```

사용자가 개발자도구나 외부 요청 도구로 `user_id`를 바꾸면 다른 사용자 작업처럼 요청할 위험이 있었다.

JWT 적용 후에는 백엔드가 다음 값을 기준으로 처리한다.

```js
req.user.user_id
req.user.role
```

즉, 프론트가 `user_id`나 `seller_id`를 보내더라도 권한 판단의 기준은 토큰이다.

적용 예시:

- 예약 생성: `req.user.user_id`를 예약자 ID로 사용
- 내 예약 조회: URL의 `userId`가 토큰의 `user_id`와 다르면 거부
- 예약 취소: 토큰 사용자 본인의 예약만 취소 가능
- 판매자 매장 조회: 토큰 사용자와 연결된 `seller_profiles.seller_id` 기준으로 조회
- 판매자 재고/예약 처리: 해당 판매자가 소유한 매장 데이터만 수정 가능
- 관리자 미매핑 처리: 처리자 ID는 토큰의 `user_id` 사용

## 12. 계정 상태 재검증

JWT는 한 번 발급되면 만료 전까지 유효할 수 있다. 따라서 관리자가 사용자를 정지했는데 기존 토큰이 계속 사용되는 문제가 생길 수 있다.

이를 줄이기 위해 백엔드 인증 미들웨어는 토큰 검증 후 DB에서 현재 사용자 상태를 다시 확인한다.

통과 조건:

```text
users.status = 'ACTIVE'
```

따라서 관리자가 계정을 `SUSPENDED`로 변경하면, 기존 토큰을 가지고 있더라도 주요 API 접근이 차단된다.

## 13. 발표 시 설명 문구

발표에서는 다음과 같이 설명할 수 있다.

```text
기존에는 프론트 저장소에 사용자 정보를 저장하고 화면만 분기하는 수준이었지만, 현재는 로그인 성공 시 백엔드가 JWT를 발급합니다. 프론트는 이 토큰을 탭별 sessionStorage에 저장하고, 모든 주요 API 요청에 Authorization 헤더로 전달합니다. 백엔드는 토큰의 서명을 검증한 뒤 role과 user_id를 기준으로 소비자, 판매자, 관리자 권한을 판단합니다. 따라서 같은 브라우저에서도 탭별 계정 시연이 가능하고, 프론트에서 user_id나 seller_id를 조작해도 백엔드가 토큰 기준으로 권한을 다시 검증합니다.
```

## 14. 현재 범위와 향후 개선점

현재 구현 범위:

- JWT 발급
- JWT 검증
- 탭별 `sessionStorage` 저장
- API 요청 시 `Authorization` 헤더 첨부
- 역할별 API 접근 제한
- 토큰 사용자 기준 권한 판정
- DB 사용자 상태 재검증

향후 운영 수준 개선점:

- 비밀번호 bcrypt 또는 argon2 해시 적용
- JWT Secret을 충분히 긴 난수로 관리
- Refresh Token 도입
- HttpOnly Secure Cookie 기반 저장 검토
- 토큰 블랙리스트 또는 세션 버전 관리
- HTTPS 도메인 적용
