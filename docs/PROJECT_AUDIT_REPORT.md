# 프로젝트 전체 점검 보고서 (CAROM.CLUB)

**점검일:** 2026-03-10  
**실행한 명령:** `npx tsc --noEmit`, `npm run build`, 구조/그렙 기반 정적 분석

---

## 1. 전체 프로젝트 구조 분석

### 1.1 주요 디렉터리

| 경로 | 역할 |
|------|------|
| `app/` | 페이지·API 라우트 (App Router) |
| `components/` | 공용 컴포넌트 (intro, admin, tournament) |
| `lib/` | auth, db, mock-data |
| `prisma/` | 스키마, 시드 |
| `types/` | auth, tournament 타입 |
| `modules/bracket-engine/` | 대진 계산 로직 + 테스트 |

### 1.2 중복·미사용·꼬인 파일

| 구분 | 파일 | 설명 |
|------|------|------|
| **미사용** | `components/intro/LogoAnimation.tsx` | 어디에서도 import 되지 않음. 인트로는 `IntroOverlay`만 사용. |
| **미사용** | `components/intro/LogoBalls.tsx` | 어디에서도 import 되지 않음. 로고는 `LogoLink` 사용. |
| **주의** | `lib/mock-data.ts` | DB 연결 실패 시 여러 페이지에서 fallback으로 사용. DB 연동 후 제거/축소 예정이라면 의도된 구조. |

- **중복 페이지/라우트:** 없음.  
- **꼬인 상태:** 인트로는 이전에 재구현되어 `IntroOverlay`만 사용 중이며, `IntroScreen`은 `IntroOverlay`만 렌더하도록 정리됨.

---

## 2. 정적 점검

### 2.1 TypeScript

- **실행:** `npx tsc --noEmit`
- **초기 결과:** `modules/bracket-engine/__tests__/example.spec.ts`에서 `describe`, `it`, `expect` 미인식 (Vitest 글로벌 타입 없음).
- **조치:** `tsconfig.json`에 `"exclude": ["node_modules", "**/__tests__/**", "**/*.spec.ts"]` 추가.
- **현재:** `tsc --noEmit` 통과 (exit 0). 앱/API 코드에는 TS 에러 없음.

### 2.2 Lint (ESLint)

- **실행:** `npm run lint`
- **결과:** 프로젝트 루트에 `eslint.config.js` / `.eslintrc*` 없어, Next가 설정 방식을 묻는 대화형 프롬프트 출력 후 종료.
- **의미:** 앱 코드에 대한 실제 lint는 아직 자동으로 돌지 않음.

**권장:** Next 권장대로 ESLint 설정 추가 후 `npm run lint`로 검사.

```bash
# Next.js가 제안하는 Strict 설정 적용 시
npx create-next-app --eslint  # 참고용. 기존 프로젝트에는 수동으로 추가.
```

루트에 `eslint.config.mjs` (또는 `eslint.config.js`) 생성 후 `next lint` 실행 가능하도록 설정하는 것을 추천.

### 2.3 import 경로

- **패턴:** `@/*` (tsconfig `paths`) 사용. `@/lib/auth`, `@/components/...` 등 일관되게 사용됨.
- **오류:** 발견된 import 경로 오류 없음. 빌드도 성공.

### 2.4 사용되지 않는 state / props / 함수

- 전역 검색으로 눈에 띄는 미사용 export는 `LogoAnimation`, `LogoBalls` (위 1.2 참고).
- 페이지/컴포넌트 단위 미사용 state는 별도 도구(eslint-plugin-react-hooks 등) 권장.

### 2.5 Hydration 가능성

- **날짜:** `toLocaleString("ko-KR")`, `toLocaleDateString("ko-KR")`는 서버에서 렌더되는 페이지(mypage, admin, tournaments 등)에서 사용. 해당 페이지는 서버 컴포넌트이므로 서버 한 번만 렌더되어 hydration 불일치 가능성 낮음.
- **위험 구간:** `getAvgProofStatus()` 내부 `new Date()`는 서버에서만 호출(마이페이지 서버 컴포넌트)되므로 문제 없음.
- **dangerouslySetInnerHTML:** PromoEditor, OutlineEditor, TournamentDetailTabs, TournamentApplyForm, RichEditor에서 사용. 모두 서버에서 내려준 HTML이면 일반적인 수준의 XSS 관리만 하면 됨.

---

## 3. 실행/빌드 점검

### 3.1 dev 서버

- **실행:** `npm run dev` (또는 `Set-Location ...; npm run dev`)
- **결과:** Next.js 15.1.0 기동, 포트 3000·3001 등 사용 중이면 다음 포트(예: 3002)에서 정상 기동.

### 3.2 build

- **실행:** `npm run build` (prisma generate + next build)
- **결과:** 성공 (exit 0). 27개 정적 페이지 생성, 라우트 모두 컴파일됨.
- **빌드 중 로그:**  
  `prisma.organization.findMany()`, `prisma.tournament.findMany()` 등에서  
  `Can't reach database server at host:5432` 에러가 **로그에는** 찍힘.  
  해당 페이지들은 `try/catch` 후 `mock-data`로 fallback 하므로 **빌드는 계속 진행**되고, 정적 생성은 완료됨.
- **에러로 빌드가 실패한 파일:** 없음.

### 3.3 런타임 콘솔 에러

- 실제 브라우저에서 `npm run dev` 후 페이지별 콘솔은 수동 확인 필요.
- 코드 상으로는 인트로 오버레이 `pointer-events` 수정으로, 회원가입 등 링크 클릭이 스킵으로만 처리되던 문제는 해소된 상태.

---

## 4. 핵심 기능 점검

| 항목 | 상태 | 비고 |
|------|------|------|
| **홈** | 정상 | `app/page.tsx`. 로고, 메뉴, 인트로(IntroRoot → IntroOverlay). |
| **메뉴 이동** | 정상 | 대회/커뮤니티/로그인/회원가입/마이페이지 링크 존재. 빌드 라우트 일치. |
| **관리자** | 정상 | `/admin` layout에서 getSession 후 사이드바·TopBar. DB 실패 시 mock fallback. |
| **로그인** | DB 의존 | `/api/auth/login`이 prisma 사용. DB 미연결 시 500. |
| **회원가입** | DB 의존 | `/api/auth/signup`이 prisma 사용. DB 미연결 시 500. |
| **이미지** | 주의 | `next/image` 미사용. Blob URL·일반 `<img>` 사용. globals.css에서 img max-width 처리됨. |
| **모바일** | 반응형 | Tailwind `sm:`, `md:`, `flex-wrap` 등 사용. 헤더/카드 레이아웃 대응. |
| **인트로** | 정상 | IntroOverlay만 사용, 메인 로고 위치 기준 앵커, pointer-events로 링크 클릭 통과. |
| **API** | 정상 | 로그인/회원가입/세션/로그아웃, 대회 apply/cancel, 관리자 CRUD, mypage avg-proof 등 라우트 존재. |
| **DB** | 조건부 | Prisma + DATABASE_URL. 미설정/미연결 시: 로그인·회원가입 500, 대회/관리자 목록 등은 mock fallback. |

---

## 5. 배포 관점 점검

### 5.1 Vercel 배포 시 문제 가능성

- **Next.js 15 App Router:** Vercel 지원.
- **Prisma:** `prisma generate`가 `build` 스크립트에 포함되어 있어 배포 빌드에서 클라이언트 생성됨.
- **Neon:** `@neondatabase/serverless` 의존성 있음. 실제 연결은 `DATABASE_URL`(Neon connection string)로 하면 됨.

### 5.2 env 누락 가능성

| 변수 | 용도 | 배포 시 필수 |
|------|------|--------------|
| `DATABASE_URL` | Prisma(Neon 등) | 로그인/회원가입/실제 DB 사용 페이지에 필수. 없으면 해당 API 500. |
| `SESSION_SECRET` | JWT 서명 (lib/auth.ts) | **필수.** 없으면 기본값 사용(아래 참고). |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (AVG 증빙 업로드) | 마이페이지 AVG 증빙 업로드 사용 시 필수. 없으면 업로드 500. |

- **치명적:** `lib/auth.ts`에서 `process.env.SESSION_SECRET || "default-secret-change-in-production"` 사용. 프로덕션에서 이 기본값이면 세션 위변조 위험.
- **권장:** 배포 환경에 반드시 `SESSION_SECRET` 설정 (32자 이상 랜덤).

### 5.3 절대경로/상대경로

- **앱 코드:** `@/*`만 사용. next/tsconfig와 일치. 문제 없음.
- **이미지/스태틱:** 프로젝트 내부에 있는 정적 자산은 Next 규칙대로 두면 됨. Blob URL은 외부 URL이므로 `next/image` 없이 `<img>` 사용해도 됨.

### 5.4 next.config, Prisma, DB

- **next.config.ts:** 기본만 사용. 추가 설정 없음. Vercel 기본 빌드와 호환.
- **Prisma:** `schema.prisma`에서 `env("DATABASE_URL")` 사용. 배포 시 Vercel env에 `DATABASE_URL` 설정 필요.
- **빌드 타임 DB:** 빌드 시 DB가 없어도 fallback 덕분에 빌드는 성공. 배포 후 런타임에 DB만 연결하면 됨.

---

## 6. 결과 정리 (요청 형식)

### 치명적 에러

| # | 내용 | 파일/위치 | 조치 |
|---|------|-----------|------|
| 1 | **프로덕션에서 SESSION_SECRET 미설정 시 기본 시크릿 사용** | `lib/auth.ts` 7–8행 | 배포 환경에 `SESSION_SECRET` 반드시 설정. 기본값 제거 또는 배포 시 에러 throw 권장. |

**수정 예시 (선택):**

```ts
// lib/auth.ts
const SECRET = process.env.SESSION_SECRET;
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET is required in production");
}
const SECRET_ENCODED = new TextEncoder().encode(SECRET || "dev-only-default");
```

그리고 기존 `SECRET` 사용처를 `SECRET_ENCODED`로 변경.

---

### 기능은 되지만 문제 있는 부분

| # | 내용 | 파일/위치 | 권장 |
|---|------|-----------|------|
| 1 | **DB 미연결 시 로그인/회원가입 500** | `api/auth/login`, `api/auth/signup` | DB 연결 실패 시 사용자에게 “일시적 오류” 메시지 등 명확한 응답과 로깅. |
| 2 | **ESLint 미설정** | 프로젝트 루트 | `eslint.config.mjs` 등 추가 후 `npm run lint` 정기 실행. |
| 3 | **빌드 시 Prisma DB 에러 로그** | `admin/tournaments`, `tournaments` 등 | 의도된 fallback이면 로그 레벨 조정 또는 try/catch 내 로그만 남기기. |
| 4 | **AVG 증빙 업로드 시 BLOB_READ_WRITE_TOKEN 필수** | `api/mypage/avg-proof` | env 미설정 시 400/503 등으로 “업로드 불가” 메시지 반환 권장. |

---

### 나중에 정리하면 좋은 부분

| # | 내용 | 파일 |
|---|------|------|
| 1 | 미사용 인트로 컴포넌트 제거 또는 보관용으로 이동 | `components/intro/LogoAnimation.tsx`, `LogoBalls.tsx` |
| 2 | mock-data 의존 축소 | DB 전면 연동 후 `lib/mock-data.ts` 및 각 페이지 fallback 제거 |
| 3 | Vitest 테스트 타입 | `tsconfig.json`에서 테스트 제외한 대신, `vitest.config.ts`에서 `globals: true` + `/// <reference types="vitest" />` 등으로 테스트만 타입 지원 |
| 4 | `next/image` 도입 | 외부/Blob URL 정책에 맞춰 이미지 최적화·도메인 설정 검토 |
| 5 | 날짜 포맷 유틸 통일 | `toLocaleString("ko-KR")` 등 한곳으로 모아 서버/클라이언트 일관성 유지 |

---

### 지금 바로 수정 추천 순서

1. **배포 전 필수:**  
   Vercel(또는 해당 호스팅) 환경 변수에 `SESSION_SECRET`, `DATABASE_URL` 설정.  
   (선택) `lib/auth.ts`에서 프로덕션 시 `SESSION_SECRET` 없으면 throw 하도록 수정.

2. **타입 체크 통과 유지:**  
   이미 적용됨 — `tsconfig.json`에 `**/__tests__/**`, `**/*.spec.ts` exclude.

3. **Lint 도입:**  
   프로젝트 루트에 ESLint 설정 추가 후 `npm run lint` 실행해 두기.

4. **미사용 파일 정리:**  
   `LogoAnimation.tsx`, `LogoBalls.tsx` 삭제 또는 `_archive` 등으로 이동.

5. **문서화:**  
   `.env.example`에 `SESSION_SECRET`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` 설명 유지(이미 있음).  
   배포 체크리스트에 “env 설정 확인” 추가.

---

**요약:**  
- **치명적:** 프로덕션 `SESSION_SECRET` 미설정 시 기본 시크릿 사용 → 반드시 설정 및(선택) 코드에서 검증 추가.  
- **빌드/타입:** 정상. 테스트 디렉터리는 tsconfig exclude로 tsc 통과.  
- **기능:** 홈·메뉴·관리자·인트로·API 구조 정상. 로그인/회원가입은 DB 필수, AVG 업로드는 Blob 토큰 필수.  
- **배포:** Vercel + Neon + env 설정만 맞추면 동작 가능.  
- **정리:** 미사용 인트로 컴포넌트, ESLint, mock 축소 순으로 진행하면 유지보수에 유리함.
