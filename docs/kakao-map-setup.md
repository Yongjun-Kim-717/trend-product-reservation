# Kakao Map API 설정 가이드

프론트엔드 소비자 화면(`/consumer`)에서 실제 카카오맵을 표시하기 위한 설정 문서입니다.

## 1. 필요한 키

프론트엔드에서는 Kakao Developers의 **JavaScript 키**를 사용합니다.

```text
VITE_KAKAO_JAVASCRIPT_KEY
```

REST API 키는 장소 검색, 주소 검색 등을 백엔드에서 호출할 때 사용합니다. 현재 프론트 지도 표시에는 JavaScript 키가 필요합니다.

## 2. Kakao Developers 설정

1. Kakao Developers에 접속합니다.
2. 내 애플리케이션을 생성하거나 기존 앱을 선택합니다.
3. 앱 키 메뉴에서 JavaScript 키를 확인합니다.
4. 플랫폼 설정에서 Web 플랫폼을 등록합니다.
5. 사이트 도메인에 아래 주소를 추가합니다.

```text
http://localhost:5173
http://127.0.0.1:5173
```

둘 중 하나만 쓰더라도, 개발 중 접속 주소가 바뀔 수 있으므로 둘 다 등록하는 것을 권장합니다.

## 3. frontend/.env 설정

`frontend/.env` 파일을 만들고 아래처럼 작성합니다.

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_KAKAO_JAVASCRIPT_KEY=발급받은_JavaScript_키
```

주의:

- 실제 키는 `.env.example`에 넣지 않습니다.
- 실제 키는 GitHub에 push하지 않습니다.
- `.env` 파일은 `.gitignore`에 의해 Git 추적에서 제외됩니다.

## 4. 실행 방법

환경변수를 수정한 뒤에는 Vite 개발 서버를 다시 시작해야 합니다.

```bash
npm.cmd run dev:frontend
```

접속 주소:

```text
http://localhost:5173/consumer
http://127.0.0.1:5173/consumer
```

## 5. 지도가 안 뜰 때 확인할 것

1. `frontend/.env`에 키가 들어갔는지 확인합니다.
2. `.env.example`이 아니라 `.env`에 넣었는지 확인합니다.
3. Vite 서버를 재시작했는지 확인합니다.
4. Kakao Developers Web 플랫폼에 `http://localhost:5173`이 등록되어 있는지 확인합니다.
5. 브라우저 개발자 도구 Console에 Kakao SDK 로딩 오류가 있는지 확인합니다.

현재 프론트엔드는 키가 없거나 SDK 로딩에 실패하면 fallback 지도를 표시합니다.
