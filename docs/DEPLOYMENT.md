# 배포 가이드

이 문서는 짤막 서비스를 Vercel(프론트엔드), Railway(백엔드), Supabase(데이터베이스)에 배포하는 방법을 설명합니다.

## 배포 구조

- **프론트엔드**: Vercel
- **백엔드**: Railway
- **데이터베이스**: Supabase (PostgreSQL)

## 사전 준비

### 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. 데이터베이스 연결 정보 확인:
   - Settings → Database → Connection string (Session Pooler)
   - 형식: `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true`

### 2. 카카오 개발자 콘솔 설정

1. [카카오 개발자 콘솔](https://developers.kakao.com)에서 앱 설정
2. 필요한 키 확인:
   - JavaScript 키 (카카오 로그인, 카카오 맵)
   - REST API 키 (역지오코딩)
   - 카카오 맵 API 키

3. 플랫폼 설정:
   - Web 플랫폼 추가
   - 사이트 도메인: Vercel 배포 URL (예: `https://your-app.vercel.app`)
   - Redirect URI: `https://your-app.vercel.app/api/auth/kakao/callback`

## Vercel 배포 (프론트엔드)

### 1. Vercel 프로젝트 생성

1. [Vercel](https://vercel.com)에 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 연결 또는 직접 업로드

### 2. 빌드 설정

Vercel이 자동으로 `vercel.json`을 인식하지만, 수동 설정이 필요한 경우:

- **Framework Preset**: Vite
- **Root Directory**: `./` (프로젝트 루트)
- **Build Command**: `cd client && pnpm install && pnpm build`
- **Output Directory**: `dist/public`
- **Install Command**: `pnpm install`

### 3. 환경 변수 설정

Vercel 대시보드 → Settings → Environment Variables에서 다음 변수 설정:

```env
# 카카오 API
VITE_KAKAO_MAP_API_KEY=your_kakao_map_api_key
VITE_KAKAO_JS_KEY=your_kakao_js_key
VITE_KAKAO_REST_API_KEY=your_kakao_rest_api_key

# 백엔드 API URL (Railway 배포 후 설정)
VITE_API_BASE_URL=https://your-backend.railway.app

# 기타 (필요시)
VITE_APP_ID=your_app_id
```

### 4. 배포

1. 코드를 GitHub에 푸시
2. Vercel이 자동으로 배포 시작
3. 배포 완료 후 도메인 확인

## Railway 배포 (백엔드)

### 1. Railway 프로젝트 생성

1. [Railway](https://railway.app)에 로그인
2. "New Project" → "Deploy from GitHub repo" 선택
3. 저장소 연결

### 2. 환경 변수 설정

Railway 대시보드 → Variables에서 다음 변수 설정:

```env
# 데이터베이스
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true

# JWT
JWT_SECRET=your_jwt_secret_key

# 환경
NODE_ENV=production

# CORS (Vercel 프론트엔드 URL)
ALLOWED_ORIGINS=https://your-app.vercel.app

# 소유자 (알림용)
OWNER_OPEN_ID=your_owner_open_id

# 포트 (Railway가 자동 할당하지만 명시 가능)
PORT=3000
```

### 3. 빌드 및 배포 설정

Railway는 `railway.json`을 자동으로 인식합니다. 수동 설정이 필요한 경우:

- **Build Command**: `pnpm build`
- **Start Command**: `pnpm start`

### 4. 정적 파일 서빙 (이미지 업로드)

**현재 상태**: 로컬 파일 시스템(`public/uploads`) 사용

**Railway 배포 시 옵션**:

1. **Railway Volume 사용** (임시 해결책)
   - Railway에서 Volume 생성 및 마운트
   - 경로: `/app/public/uploads`
   - ⚠️ 주의: Railway Volume은 영구 저장소가 아니므로 데이터 손실 가능

2. **클라우드 스토리지 사용** (권장)
   - AWS S3
   - Cloudflare R2
   - Supabase Storage
   - ⚠️ 현재 코드는 로컬 파일 시스템을 사용하므로, 클라우드 스토리지로 마이그레이션 필요

**임시 해결책**: Railway Volume을 사용하되, 프로덕션에서는 반드시 클라우드 스토리지로 마이그레이션 권장

### 5. 배포

1. 코드를 GitHub에 푸시
2. Railway가 자동으로 빌드 및 배포 시작
3. 배포 완료 후 URL 확인 (예: `https://your-backend.railway.app`)

## Supabase 데이터베이스 마이그레이션

### 1. 로컬에서 마이그레이션 실행

```bash
# 환경 변수 설정
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true"

# 마이그레이션 실행
pnpm db:push
```

### 2. 또는 Supabase SQL Editor에서 직접 실행

`drizzle/0000_swift_kabuki.sql` 파일의 내용을 Supabase SQL Editor에서 실행

## 배포 후 확인 사항

### 1. 프론트엔드 (Vercel)

- [ ] 사이트 접속 확인
- [ ] 카카오 맵 로드 확인
- [ ] 카카오 로그인 작동 확인
- [ ] API 호출 확인 (Network 탭)

### 2. 백엔드 (Railway)

- [ ] API 엔드포인트 접속 확인 (`/api/trpc/system.health`)
- [ ] 데이터베이스 연결 확인
- [ ] 이미지 업로드 경로 확인 (`/uploads`)

### 3. 데이터베이스 (Supabase)

- [ ] 테이블 생성 확인
- [ ] 마이그레이션 적용 확인

## 환경 변수 체크리스트

### Vercel (프론트엔드)

- [ ] `VITE_KAKAO_MAP_API_KEY`
- [ ] `VITE_KAKAO_JS_KEY`
- [ ] `VITE_KAKAO_REST_API_KEY`
- [ ] `VITE_API_BASE_URL` (Railway 백엔드 URL)

### Railway (백엔드)

- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` (Vercel 프론트엔드 URL)
- [ ] `OWNER_OPEN_ID` (선택사항)

## 문제 해결

### 프론트엔드가 백엔드에 연결되지 않음

1. `VITE_API_BASE_URL`이 올바른지 확인
2. Railway 백엔드가 실행 중인지 확인
3. CORS 설정 확인 (`ALLOWED_ORIGINS`)

### 카카오 맵/로그인이 작동하지 않음

1. 카카오 개발자 콘솔에서 도메인 설정 확인
2. API 키가 올바른지 확인
3. Redirect URI가 올바른지 확인

### 데이터베이스 연결 실패

1. `DATABASE_URL` 형식 확인 (Session Pooler 사용)
2. Supabase 방화벽 설정 확인
3. 연결 문자열의 비밀번호 확인

### 이미지 업로드 실패

1. Railway Volume 마운트 확인
2. 또는 클라우드 스토리지(S3)로 마이그레이션 고려

## 추가 개선 사항

### 이미지 스토리지

현재는 로컬 파일 시스템을 사용하지만, 프로덕션에서는 다음을 권장:

- **AWS S3**
- **Cloudflare R2**
- **Supabase Storage**

### 모니터링

- Railway: 내장 로그 확인
- Vercel: Analytics 및 Logs 확인
- Supabase: Database → Logs 확인

### 백업

- Supabase: 자동 백업 설정 확인
- Railway: 데이터베이스 백업 스케줄 설정

## 배포 후 다음 단계

1. 관리자 UI 개발 (행정 상태 관리)
2. 이미지 스토리지 클라우드 마이그레이션
3. 모니터링 및 로깅 설정
4. 성능 최적화
5. SEO 설정

