# 배포 단계별 가이드

## 현재 상태
✅ Git 저장소 초기화 완료
✅ Railway CLI 설치 완료
✅ Vercel CLI 설치 확인 완료
✅ 배포 설정 파일 생성 완료

## 다음 단계

### 1. GitHub 저장소 연결 (필수)

```bash
# GitHub에서 새 저장소 생성 후
git remote add origin https://github.com/your-username/jjalmak.git
git branch -M main
git push -u origin main
```

### 2. Railway 배포 (백엔드)

#### 2-1. Railway 로그인
터미널에서 실행:
```bash
railway login
```
브라우저가 열리면 Railway 계정으로 로그인하세요.

#### 2-2. 프로젝트 초기화
```bash
railway init
# 프로젝트 이름: jjalmak-backend (또는 원하는 이름)
```

#### 2-3. 환경 변수 설정
Supabase 연결 정보를 확인한 후:

```bash
# 데이터베이스 연결 (Supabase Session Pooler URL)
railway variables set DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# JWT 시크릿 (강력한 랜덤 문자열 - 최소 32자)
railway variables set JWT_SECRET="your_very_secure_jwt_secret_key_here"

# 환경 설정
railway variables set NODE_ENV=production

# CORS (Vercel 배포 후 업데이트 필요)
railway variables set ALLOWED_ORIGINS="https://your-app.vercel.app"

# 소유자 (선택사항)
railway variables set OWNER_OPEN_ID="your_owner_open_id"
```

#### 2-4. 배포
```bash
railway up
```

#### 2-5. 배포 URL 확인
```bash
railway domain
# 또는
railway status
```

### 3. Vercel 배포 (프론트엔드)

#### 3-1. Vercel 로그인
```bash
vercel login
```

#### 3-2. 프로젝트 초기화 및 배포
```bash
vercel
# 질문에 답변:
# - Set up and deploy? Yes
# - Which scope? (계정 선택)
# - Link to existing project? No
# - Project name? jjalmak
# - Directory? ./
# - Override settings? No (vercel.json 사용)
```

#### 3-3. 환경 변수 설정
```bash
# 카카오 API 키
vercel env add VITE_KAKAO_MAP_API_KEY production
vercel env add VITE_KAKAO_JS_KEY production
vercel env add VITE_KAKAO_REST_API_KEY production

# 백엔드 API URL (Railway 배포 후)
vercel env add VITE_API_BASE_URL production
# 값: https://your-backend.railway.app (Railway에서 확인한 URL)
```

#### 3-4. 프로덕션 배포
```bash
vercel --prod
```

### 4. 배포 후 설정

#### 4-1. Railway CORS 업데이트
Vercel 배포 URL을 확인한 후:
```bash
railway variables set ALLOWED_ORIGINS="https://your-app.vercel.app"
```

#### 4-2. Vercel API URL 업데이트
Railway 배포 URL을 확인한 후:
```bash
vercel env add VITE_API_BASE_URL production
# 값: https://your-backend.railway.app
```

#### 4-3. 카카오 개발자 콘솔 업데이트
1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속
2. 앱 설정 → 플랫폼 → Web 플랫폼
3. 사이트 도메인 추가: `https://your-app.vercel.app`
4. Redirect URI 추가: `https://your-app.vercel.app/api/auth/kakao/callback`

### 5. 데이터베이스 마이그레이션

Supabase에 이미 연결되어 있다고 하셨으니, 마이그레이션이 필요하면:

```bash
# 로컬에서 실행 (DATABASE_URL 환경 변수 설정 후)
export DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
pnpm db:push
```

또는 Supabase SQL Editor에서 `drizzle/0000_swift_kabuki.sql` 파일 내용 실행

## 유용한 명령어

### Railway
```bash
railway logs          # 로그 확인
railway variables      # 환경 변수 확인
railway status         # 서비스 상태
railway domain         # 도메인 확인
```

### Vercel
```bash
vercel ls              # 배포 목록
vercel logs            # 배포 로그
vercel env ls          # 환경 변수 목록
```

## 문제 해결

### Railway 배포 실패
- `railway logs`로 로그 확인
- 환경 변수 확인: `railway variables`
- `railway.json` 빌드 설정 확인

### Vercel 배포 실패
- Vercel 대시보드에서 빌드 로그 확인
- 환경 변수 확인: `vercel env ls`
- `vercel.json` 설정 확인

### 데이터베이스 연결 실패
- `DATABASE_URL` 형식 확인 (Session Pooler 사용)
- Supabase 방화벽 설정 확인
- 연결 문자열의 비밀번호 확인

## 참고 문서

- 상세 배포 가이드: `docs/DEPLOYMENT.md`
- CLI 배포 가이드: `docs/DEPLOYMENT_CLI.md`
- 카카오 설정 가이드: `docs/KAKAO_SETUP.md`

