# Phase 4 구현 지시서 — 보안 및 Railway 배포

> 전체 설계는 SPEC.md, 이전 구현은 PHASE1~3.md 참고.
> 새 기능 추가 없이 보안 강화 + 배포 구성만 다룬다.

---

## 구현 범위

- 관리자 인증 (환경변수 기반 패스워드, JWT 없이 심플하게)
- CORS 도메인 제한
- Railway 배포 구성 (모노레포, 프론트/백 별도 서비스)
- rembg 모델 워밍업

---

## 1. 관리자 인증

DB 없이 환경변수 기반으로 구현한다.

### 흐름

```
프론트: 비밀번호 입력 → POST /auth/login
백엔드: ADMIN_PASSWORD 환경변수와 비교 → 일치하면 토큰 반환
프론트: 토큰을 sessionStorage에 저장
이후 모든 파이프라인 요청: Authorization: Bearer <token> 헤더 포함
백엔드: 토큰 검증 후 처리
```

### 토큰 방식

JWT 없이 단순하게 구현한다.

- 로그인 성공 시 `secrets.token_hex(32)`로 랜덤 토큰 생성
- 백엔드 메모리(set)에 유효 토큰 보관
- 토큰 만료: 없음 (서버 재시작 시 자동 초기화)
- 동시 세션 제한 없음

### 백엔드 추가 사항

**환경변수 추가:**

백엔드 .env에 설정되어 있음.

```
ADMIN_PASSWORD=your_password_here
```

**신규 라우터: `routes/auth.py`**

```
POST /auth/login
  body: { "password": "..." }
  response: { "token": "abc123..." }  또는 401

POST /auth/logout
  header: Authorization: Bearer <token>
  response: { "ok": true }
```

**인증 미들웨어:**

- `dependencies/auth.py`에 `verify_token` dependency 구현
- `/health`, `/auth/login`은 인증 제외
- 나머지 모든 라우터에 `Depends(verify_token)` 적용

### 프론트엔드 추가 사항

- 앱 진입 시 sessionStorage에 토큰 없으면 로그인 페이지로 이동
- 로그인 성공 후 원래 페이지로 redirect
- 모든 API 요청에 `Authorization: Bearer <token>` 헤더 추가
- 401 응답 시 로그인 페이지로 redirect
- 로그아웃 버튼 (토큰 삭제 + 로그인 페이지 이동)

---

## 2. CORS 설정

`main.py`의 `allow_origins=["*"]`를 환경변수로 교체한다.

```python
import os

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**환경변수:**

```
# 로컬
ALLOWED_ORIGINS=http://localhost:5173

# Railway (배포 후 프론트 도메인으로 설정)
ALLOWED_ORIGINS=https://your-frontend.up.railway.app
```

---

## 3. Railway 배포 구성

### 모노레포 구조 그대로 사용

Railway에서 같은 GitHub 레포를 연결하고 서비스별로 루트 디렉토리만 다르게 지정한다.

```
GitHub repo: your-repo
├── frontend/   ← 서비스 1 루트
└── backend/    ← 서비스 2 루트
```

### 서비스 1: Frontend

| 항목           | 값                |
| -------------- | ----------------- |
| Root Directory | `/frontend`       |
| Build Command  | `npm run build`   |
| Start Command  | (Dockerfile 사용) |

**`frontend/Dockerfile`** (이미 있으면 확인, 없으면 생성):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**`frontend/nginx.conf`**:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Railway 환경변수 (서비스 1):**

```
VITE_API_URL=https://your-backend.up.railway.app
```

### 서비스 2: Backend

| 항목           | 값                |
| -------------- | ----------------- |
| Root Directory | `/backend`        |
| Build Command  | (Dockerfile 사용) |
| Start Command  | (Dockerfile CMD)  |

**`backend/Dockerfile`** (rembg 모델 워밍업 포함):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# rembg 모델 미리 다운로드 (콜드 스타트 방지)
RUN python -c "from rembg import new_session; new_session('u2net')"

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**Railway 환경변수 (서비스 2):**

```
ADMIN_PASSWORD=your_password_here
OPENAI_API_KEY=sk-...
ALLOWED_ORIGINS=https://your-frontend.up.railway.app
```

### 배포 순서

1. GitHub 레포 Railway에 연결
2. 백엔드 서비스 먼저 배포 → 도메인 확인
3. 프론트 서비스 배포 시 `VITE_API_URL`에 백엔드 도메인 입력
4. 백엔드 `ALLOWED_ORIGINS`에 프론트 도메인 입력
5. 프론트에서 `/health` 호출해 연결 확인

---

## 4. 환경변수 정리

### 로컬 개발 (`backend/.env`)

```
ADMIN_PASSWORD=localpass
OPENAI_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:5173
```

### 로컬 개발 (`frontend/.env`)

```
VITE_API_URL=http://localhost:8000
```

Railway에서는 `.env` 파일 대신 Railway 대시보드 환경변수로 동일하게 설정한다.

---

## 구현 시 주의사항

- 토큰은 메모리에만 보관하므로 서버 재시작(배포) 시 기존 토큰 무효화됨. 재로그인 필요
- `VITE_API_URL`은 빌드 타임에 번들에 포함되므로 변경 시 프론트 재배포 필요
- rembg 첫 빌드는 모델 다운로드로 10분 이상 걸릴 수 있음. Railway 빌드 타임아웃 확인 필요
- Railway 무료 플랜은 메모리 512MB. rembg 실행 시 초과할 수 있으니 OOM 발생하면 유료($5/월)로 업그레이드
