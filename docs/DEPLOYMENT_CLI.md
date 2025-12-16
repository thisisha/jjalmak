# CLI 배포 가이드

이 문서는 Railway와 Vercel CLI를 사용한 배포 방법을 설명합니다.

## 사전 준비

### 1. Git 저장소 초기화 (완료)

```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. GitHub 저장소 연결

```bash
# GitHub에서 새 저장소 생성 후
git remote add origin https://github.com/your-username/jjalmak.git
git branch -M main
git push -u origin main
```

## Railway 배포 (백엔드)

### 1. Railway 로그인

```bash
railway login
# 브라우저가 열리면 Railway 계정으로 로그인
```

### 2. 프로젝트 초기화

```bash
railway init
# 프로젝트 이름 입력 (예: jjalmak-backend)
```

### 3. 환경 변수 설정

```bash
# Supabase 데이터베이스 연결
railway variables set DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"

# JWT 시크릿 (강력한 랜덤 문자열 생성)
railway variables set JWT_SECRET="your_very_secure_jwt_secret_key"

# 환경 설정
railway variables set NODE_ENV=production

# CORS 설정 (Vercel 프론트엔드 URL - 배포 후 업데이트)
railway variables set ALLOWED_ORIGINS="https://your-app.vercel.app"

# 소유자 (선택사항)
railway variables set OWNER_OPEN_ID="your_owner_open_id"
```

### 4. 배포

```bash
railway up
```

또는 GitHub 연동 후 자동 배포:

```bash
railway link
# GitHub 저장소 연결
```

### 5. 배포 URL 확인

```bash
railway domain
# 또는 Railway 대시보드에서 확인
```

## Vercel 배포 (프론트엔드)

### 1. Vercel 로그인

```bash
vercel login
# 브라우저가 열리면 Vercel 계정으로 로그인
```

### 2. 프로젝트 초기화

```bash
vercel
# 프로젝트 설정 질문에 답변
# - Set up and deploy? Yes
# - Which scope? (계정 선택)
# - Link to existing project? No
# - Project name? jjalmak
# - Directory? ./
# - Override settings? No (vercel.json 사용)
```

### 3. 환경 변수 설정

```bash
# 카카오 API 키
vercel env add VITE_KAKAO_MAP_API_KEY
vercel env add VITE_KAKAO_JS_KEY
vercel env add VITE_KAKAO_REST_API_KEY

# 백엔드 API URL (Railway 배포 후)
vercel env add VITE_API_BASE_URL
# 값 입력: https://your-backend.railway.app
```

또는 대시보드에서 설정:
- Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

### 4. 프로덕션 배포

```bash
vercel --prod
```

### 5. 배포 URL 확인

```bash
vercel ls
# 또는 Vercel 대시보드에서 확인
```

## 배포 후 설정

### 1. Railway CORS 업데이트

Vercel 배포 후 Railway의 `ALLOWED_ORIGINS` 업데이트:

```bash
railway variables set ALLOWED_ORIGINS="https://your-app.vercel.app"
```

### 2. Vercel API URL 업데이트

Railway 배포 후 Vercel의 `VITE_API_BASE_URL` 업데이트:

```bash
vercel env add VITE_API_BASE_URL production
# 값 입력: https://your-backend.railway.app
```

### 3. 카카오 개발자 콘솔 업데이트

1. Web 플랫폼 도메인 추가: Vercel 배포 URL
2. Redirect URI 추가: `https://your-app.vercel.app/api/auth/kakao/callback`

## 유용한 명령어

### Railway

```bash
# 로그 확인
railway logs

# 환경 변수 확인
railway variables

# 서비스 상태 확인
railway status

# 도메인 확인
railway domain
```

### Vercel

```bash
# 배포 목록
vercel ls

# 최근 배포 로그
vercel logs

# 환경 변수 확인
vercel env ls

# 프로젝트 정보
vercel inspect
```

## 문제 해결

### Railway 배포 실패

1. 로그 확인: `railway logs`
2. 빌드 명령어 확인: `railway.json` 확인
3. 환경 변수 확인: `railway variables`

### Vercel 배포 실패

1. 빌드 로그 확인: Vercel 대시보드 → Deployments
2. 환경 변수 확인: `vercel env ls`
3. 빌드 설정 확인: `vercel.json` 확인

### 데이터베이스 연결 실패

1. `DATABASE_URL` 형식 확인 (Session Pooler 사용)
2. Supabase 방화벽 설정 확인
3. 연결 문자열의 비밀번호 확인

