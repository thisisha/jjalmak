# 짤막 (Jjalmak) - 지역 기반 커뮤니티 플랫폼

짤막은 동네 주민들이 불편사항, 제안, 칭찬 등을 공유하고 소통하는 지역 기반 커뮤니티 플랫폼입니다.

## 주요 기능

- 📝 게시글 작성 (카테고리별 분류, 이미지 첨부, 위치 태그)
- 💬 댓글 및 공감 기능
- 🗺️ 지도 기반 게시글 탐색 (카카오 맵)
- 🔔 알림 시스템
- 👤 프로필 관리
- 🏘️ 동네 기반 필터링

## 기술 스택

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- tRPC
- Wouter (라우팅)
- Radix UI
- react-kakao-maps-sdk

### Backend
- Express
- tRPC
- Drizzle ORM
- PostgreSQL (Supabase)
- JWT (세션 관리)

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 데이터베이스 (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true

# JWT Secret
JWT_SECRET=your-random-secret-key-here

# 카카오 API
VITE_KAKAO_MAP_API_KEY=your-kakao-map-javascript-key
VITE_KAKAO_JS_KEY=your-kakao-javascript-key
VITE_KAKAO_REST_API_KEY=your-kakao-rest-api-key

# 앱 설정
VITE_APP_ID=jjalmak-dev
```

### 3. 데이터베이스 마이그레이션

```bash
pnpm db:push
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

서버는 `http://localhost:3000`에서 실행됩니다.

## 카카오 API 설정

자세한 설정 방법은 [docs/KAKAO_SETUP.md](docs/KAKAO_SETUP.md)를 참고하세요.

## 배포

배포 가이드는 다음 문서를 참고하세요:
- [DEPLOY_STEPS.md](DEPLOY_STEPS.md) - 단계별 배포 가이드
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - 상세 배포 가이드
- [docs/DEPLOYMENT_CLI.md](docs/DEPLOYMENT_CLI.md) - CLI 배포 가이드

## 프로젝트 구조

```
jjalmak/
├── client/          # React 프론트엔드
│   └── src/
│       ├── components/  # 재사용 가능한 컴포넌트
│       ├── pages/       # 페이지 컴포넌트
│       ├── contexts/    # React Context
│       └── lib/         # 유틸리티 함수
├── server/          # Express 백엔드
│   ├── _core/       # 핵심 서버 로직
│   └── routers.ts   # tRPC 라우터
├── drizzle/         # 데이터베이스 스키마 및 마이그레이션
└── shared/          # 공유 타입 및 상수
```

## 주요 기능 설명

### 인증
- 간단한 이메일/닉네임 기반 로그인
- 카카오 로그인 지원
- JWT 기반 세션 관리

### 게시글
- 카테고리: 불편신고, 제안, 칭찬, 잡담, 긴급
- 이미지 업로드 (최대 3장)
- 위치 정보 태그
- 익명 옵션
- 행정 상태 관리 (검토대기, 처리중, 완료, 반려)

### 지도
- 카카오 맵 기반 게시글 표시
- 카테고리별 핀 아이콘
- 마커 클러스터링
- 지도 범위 기반 게시글 필터링

## 라이선스

MIT
