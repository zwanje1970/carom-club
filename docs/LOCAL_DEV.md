# 로컬 개발 가이드

GitHub/배포는 나중으로 미루고, **로컬에서 안정적으로 실행·개발**하기 위한 기준만 정리했습니다.

---

## 1. 로컬 실행 점검 결과

| 항목 | 명령 | 결과 |
|------|------|------|
| 타입 체크 | `npx tsc --noEmit` | ✅ 통과 (테스트 디렉터리 제외) |
| 빌드 | `npm run build` | ✅ 통과 (DB 미연결 시 로그는 나오지만 mock fallback으로 완료) |
| 개발 서버 | `npm run dev` | ✅ 기동 (포트 3000 등) |

- **Lint:** `.eslintrc.json` 있으면 `npm run lint` 사용 가능. 설정 없으면 나중 작업으로 두어도 됨.

---

## 2. SESSION_SECRET — 로컬 안전성 / dev·prod 차이

### 로컬(개발)에서
- **`SESSION_SECRET`이 없어도 앱이 뜹니다.**
- `lib/auth.ts`에서 **`NODE_ENV === "production"`일 때만** 값이 없으면 throw 합니다.
- 로컬은 보통 `NODE_ENV=development`이므로, **기본값(`default-secret-change-in-production`)이 사용**됩니다.
- 따라서 **로컬에서는 .env에 SESSION_SECRET을 넣지 않아도 실행 가능**합니다.

### 프로덕션(배포)에서
- `NODE_ENV === "production"`이면 **반드시 `SESSION_SECRET`이 있어야** 합니다.
- 없으면 **앱 기동 시점에 에러**가 나서 서버가 올라오지 않습니다.
- 배포 전에 env에 `SESSION_SECRET`을 설정하는 것은 **나중(GitHub/배포 단계)** 에 하면 됩니다.

**정리:** 로컬만 쓸 때는 SESSION_SECRET 없이도 안전하게 동작합니다.

---

## 3. 로그인/회원가입 — DB 미연결 시

### 동작 방식
- **DB에 연결할 수 없을 때** (DATABASE_URL 잘못됨, DB 꺼짐 등):
  - **사용자에게:** HTTP **503** + 메시지  
    `"데이터베이스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."`
  - **서버 로그:** `[login] DB error:` 또는 `[signup] DB error:` + 실제 에러 내용
- **그 외 서버 에러:** 500 + `"로그인/회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."`  
  서버에는 `[login] error:` / `[signup] error:` 로그.

### 로컬에서 env 없을 때 어떤 문제가 나는지

| env / 상황 | 현상 | 사용자 화면 | 서버 로그 |
|------------|------|-------------|-----------|
| **DATABASE_URL 없음** | Prisma가 연결 실패 | 로그인/회원가입 시 503 + 위 메시지 | `[login] DB error:` / `[signup] DB error:` |
| **DATABASE_URL 잘못됨** (호스트/비번 오타 등) | 위와 동일 | 동일 | 동일 |
| **DB 서버 꺼짐** | 위와 동일 | 동일 | 동일 |
| **SESSION_SECRET 없음** (로컬) | 정상 동작 | 로그인/세션 동작 | 없음 (기본 시크릿 사용) |

- **로컬에서 DB 없이 화면만 볼 때:**  
  대회 목록·관리자 목록 등은 **mock fallback**으로 동작합니다.  
  로그인·회원가입만 DB가 꼭 필요하고, 그때는 위처럼 503 + 안내 메시지가 나옵니다.

### "데이터베이스에 일시적으로 연결할 수 없습니다"가 나올 때 (로그인하려면 DB 필요)

로그인·회원가입을 쓰려면 **PostgreSQL**이 필요합니다. 아래 중 하나만 하면 됩니다.

1. **`.env` 파일에 `DATABASE_URL` 넣기**  
   프로젝트 루트에 `.env`가 없다면 `.env.example`을 복사해 `.env`로 만든 뒤, `DATABASE_URL`만 실제 값으로 바꿉니다.

2. **DB 준비 (택 1)**  
   - **로컬 PostgreSQL:**  
     예: `postgresql://postgres:비밀번호@localhost:5432/carom`  
     (설치 후 DB 생성: `createdb carom` 등)
   - **Docker:**  
     `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=carom postgres:16`  
     → `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carom"`
   - **Neon(클라우드):**  
     [neon.tech](https://neon.tech)에서 프로젝트 생성 후 Connection string 복사 → `DATABASE_URL`에 붙여넣기.

3. **테이블 생성**  
   터미널에서:
   ```bash
   npx prisma db push
   ```
   (또는 마이그레이션 쓰는 경우 `npx prisma migrate dev`)

4. **회원가입 후 로그인**  
   DB가 연결되면 `/signup`에서 계정을 만든 뒤, 같은 계정으로 `/login`하면 됩니다.

---

## 4. 업로드(AVG 증빙) — BLOB_READ_WRITE_TOKEN 없을 때

### 로컬에서
- **`BLOB_READ_WRITE_TOKEN`이 없으면:**
  - API가 **503**을 반환하고,  
    `"이미지 저장 설정이 되어 있지 않아 업로드할 수 없습니다. 관리자에게 문의해 주세요."` 를 **JSON `error` 필드**로 돌려줍니다.
  - 서버 로그: `[avg-proof] BLOB_READ_WRITE_TOKEN is not set`
- **마이페이지 화면:**  
  업로드 실패 시 API의 `error` 문구가 그대로 **빨간색 에러 메시지**로 표시됩니다.

### 정리
- 로컬에서 BLOB 없이 개발해도 **앱은 정상 기동**됩니다.
- AVG 증빙 업로드만 실패하고, **이유를 알 수 있는 메시지**가 사용자·서버 양쪽에 나오도록 되어 있습니다.

---

## 5. 인트로 — 실제 사용 파일 vs 미사용(보관)

### 지금 실제로 사용 중인 인트로 관련 파일
| 파일 | 역할 |
|------|------|
| `components/intro/IntroRoot.tsx` | 앱 레이아웃에서 감싸서, 인트로 표시 여부 제어 |
| `components/intro/IntroScreen.tsx` | 인트로가 켜져 있을 때 `IntroOverlay`만 렌더 |
| `components/intro/IntroOverlay.tsx` | 인트로 애니메이션(공·텍스트) 전부 담당 |
| `components/intro/useIntroController.tsx` | 인트로 표시/숨김/다시보기 상태·함수 제공 |
| `components/intro/LogoLink.tsx` | 헤더·푸터 로고 + 인트로 다시보기 링크, `data-main-logo` 등 |

- **app/layout.tsx** 에서 `IntroRoot`를 사용하고,  
  각 페이지에서 **LogoLink** 로 로고를 쓰는 구조입니다.

### 미사용(보관용) — 삭제하지 않고 이동해 둔 것
| 보관 위치 | 설명 |
|-----------|------|
| `components/_unused/intro/LogoAnimation.tsx` | 예전 인트로 애니메이션 (현재는 IntroOverlay 사용) |
| `components/_unused/intro/LogoBalls.tsx` | 3공 로고만 쓰던 컴포넌트 (현재는 LogoLink 사용) |

- **어디에서도 import 하지 않음**을 확인한 뒤 `_unused`로 옮겨 두었습니다.
- 필요하면 참고용으로만 쓰고, 재사용 시 `components/intro/` 등 적절한 위치로 옮기면 됩니다.

---

## 6. 로컬 기준 결과 요약

### 지금 로컬에서 실행 가능한지
- **가능합니다.**  
  `npm run dev`, `npm run build`, `npx tsc --noEmit` 모두 통과하는 상태입니다.

### 아직 남은 에러가 있는지
- **치명적인 에러는 없습니다.**  
  타입 에러 없고, 빌드도 성공합니다.  
  빌드 중 DB 연결 실패 로그는 나올 수 있지만, mock fallback으로 빌드는 끝까지 완료됩니다.

### 로컬에서 꼭 필요한 env가 무엇인지
- **없어도 앱은 뜹니다.**
  - **DB 쓰는 기능(로그인·회원가입 등)** 을 쓰려면 → `DATABASE_URL` 필요. 없으면 503 + 안내 메시지.
  - **AVG 증빙 업로드** 를 쓰려면 → `BLOB_READ_WRITE_TOKEN` 필요. 없으면 503 + 안내 메시지.
  - **SESSION_SECRET** 은 로컬(development)에서는 없어도 기본값으로 동작합니다.

### 나중에 GitHub/배포 전에 하면 되는 작업
- 배포용 env 설정 (예: Vercel에 DATABASE_URL, SESSION_SECRET 등 설정)
- SESSION_SECRET을 프로덕션용으로 반드시 설정
- (선택) Lint 설정·스크립트 정리

**배포/Vercel 설명은 별도 문서로 미뤄 두었고, 이 문서는 로컬 실행 안정화·에러 제거·구조 정리에만 맞춰져 있습니다.**

---

## 7. 로컬에서 500 / Internal Server Error 가 날 때

**증상:** 브라우저에 "Internal Server Error" 또는 "HTTP ERROR 500", 터미널에 `UNKNOWN: unknown error, open '.next\...'` (errno -4094)

**원인:** Windows에서 Next.js가 캐시 파일을 읽거나 쓸 때 다른 프로그램(백신, 인덱서 등)이 파일을 잠그거나 차단하는 경우.

**조치:**
1. **다른 dev 서버 모두 종료**  
   터미널/창에서 돌아가는 `npm run dev`를 전부 끈 뒤, **한 번만** `npm run dev` 실행하고 `http://localhost:3000` 으로 접속해 보기.
2. **캐시 경로**  
   `next.config.ts`에서 `distDir`을 `node_modules/.cache/next-build`로 두었습니다. (프로젝트 루트 `.next` 대신 사용해 잠금을 피하려는 설정)
3. **백신 예외**  
   Windows Defender 등에서 `c:\project\jukbang-platform-v2` (또는 해당 프로젝트 폴더)를 **실시간 검사 제외**에 넣어 보기.
4. **캐시 삭제 후 재시작**  
   `node_modules/.cache/next-build` 폴더를 삭제한 뒤 다시 `npm run dev` 실행.

---

## 8. Prisma generate EPERM (Windows)

**증상:** `npx prisma generate` 실행 시  
`EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'`

**원인:** Node(Next.js) 또는 Cursor/IDE가 `node_modules\.prisma\client\query_engine-windows.dll.node`를 열어 둔 상태에서 Prisma가 같은 파일을 덮어쓰려다 실패함.

**조치 (아래 중 하나만 해도 됨):**

1. **개발 서버 끄고 generate**  
   - `npm run dev`가 돌아가는 터미널을 모두 종료한 뒤  
   - 새 터미널에서 `npx prisma generate` 실행  
   - 성공하면 다시 `npm run dev` 실행

2. **Cursor를 완전히 종료한 뒤 generate**  
   - Cursor(및 이 프로젝트)를 모두 닫기  
   - **Cursor가 아닌** 일반 PowerShell 또는 명령 프롬프트를 열고  
   - `cd c:\project\jukbang-platform-v2` 후 `npx prisma generate` 실행  
   - 성공하면 Cursor를 다시 열기

3. **PC 재시작 후 generate**  
   - 재부팅 후 다른 프로그램을 켜기 전에  
   - 프로젝트 폴더에서 `npx prisma generate` 실행

**참고:** `npm run build`는 내부에서 `prisma generate`를 먼저 실행합니다. 위 EPERM이 나오지 않는 환경(예: CI, 다른 PC)에서는 빌드만 해도 클라이언트가 최신으로 생성됩니다.

**현재 설정:** Prisma 클라이언트는 `node_modules\.prisma`가 아니라 **`generated/prisma`** 폴더에 생성되도록 되어 있습니다. 따라서 기존에 잠겨 있던 DLL과 충돌하지 않고, **dev 서버를 켠 상태에서도** `npx prisma generate`가 정상적으로 동작합니다.
