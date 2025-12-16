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
- React 19
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
- MySQL
- JWT (세션 관리)

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 데이터베이스
DATABASE_URL=mysql://user:password@localhost:3306/dbname

# JWT Secret
JWT_SECRET=your-random-secret-key-here

# 카카오 API (선택적)
VITE_KAKAO_MAP_API_KEY=your-kakao-map-javascript-key
VITE_KAKAO_JS_KEY=your-kakao-javascript-key

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

### 카카오 맵 API 키 발급 방법

1. **카카오 개발자 센터 접속**
   - [https://developers.kakao.com/](https://developers.kakao.com/) 접속
   - 카카오 계정으로 로그인 (없으면 회원가입)

2. **애플리케이션 등록**
   - 우측 상단 "내 애플리케이션" 클릭
   - "애플리케이션 추가하기" 클릭
   - 앱 이름: "짤막" (또는 원하는 이름)
   - 사업자명: 개인/회사 선택
   - 저장

3. **JavaScript 키 확인**
   - 등록한 애플리케이션 선택
   - "앱 키" 메뉴 클릭
   - **JavaScript 키** 복사 (이게 `VITE_KAKAO_MAP_API_KEY`에 들어갈 값)

4. **플랫폼 설정 (웹)**
   - "플랫폼" 메뉴 클릭
   - "Web 플랫폼 등록" 클릭
   - 사이트 도메인 입력:
     - 개발: `http://localhost:3000`
     - 운영: 실제 도메인 (예: `https://yourdomain.com`)
   - 저장

5. **환경 변수 설정**
   - `.env` 파일에 추가:
   ```env
   VITE_KAKAO_MAP_API_KEY=발급받은_JavaScript_키
   ```

### 카카오 로그인 API 키 발급 방법

1. **카카오 로그인 활성화**
   - 카카오 개발자 센터에서 등록한 애플리케이션 선택
   - 좌측 메뉴에서 **"제품 설정"** 클릭
   - **"카카오 로그인"** 클릭
   - "활성화 설정" 토글을 **ON**으로 변경
   - "동의항목" 설정:
     - 필수: 닉네임, 프로필 사진
     - 선택: 이메일 (원하는 경우)
   - 저장

2. **Redirect URI 설정 (중요!)**
   - 같은 "카카오 로그인" 페이지에서 아래로 스크롤
   - **"Redirect URI"** 섹션 찾기
   - **"URI 추가"** 버튼 클릭
   - 개발용 URI 입력:
     ```
     http://localhost:3000/auth/kakao/callback
     ```
   - 운영용 URI 입력 (배포 후):
     ```
     https://yourdomain.com/auth/kakao/callback
     ```
   - **"저장"** 버튼 클릭
   - ⚠️ **주의**: URI는 정확히 일치해야 합니다 (마지막 `/` 포함 여부도 중요!)

3. **Redirect URI 확인 방법**
   - 설정 후 "Redirect URI" 목록에 등록된 URI가 표시됩니다
   - 여러 개 등록 가능 (개발용, 운영용 등)

3. **JavaScript 키 확인**
   - "앱 키" 메뉴에서 **JavaScript 키** 확인 (맵과 동일한 키 사용 가능)
   - `.env` 파일에 추가:
   ```env
   VITE_KAKAO_JS_KEY=발급받은_JavaScript_키
   ```

### 참고사항

- **JavaScript 키는 공개되어도 안전합니다** (도메인 제한으로 보호됨)
- 개발 단계에서는 `localhost` 도메인 등록 필요
- 운영 배포 시 실제 도메인 등록 필수
- 무료 사용량: 월 300,000건 (일반적으로 충분)

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

### 지도
- 카카오 맵 기반 게시글 표시
- 카테고리별 핀 아이콘
- 지도 범위 기반 게시글 필터링

## 라이선스

MIT

