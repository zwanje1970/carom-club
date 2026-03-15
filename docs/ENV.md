# 환경 변수 (Environment Variables)

- **로컬 개발 기준** (실행 안정화, 어떤 env가 없으면 어떤 문제가 나는지): **`docs/LOCAL_DEV.md`** 참고.
- 아래는 env 목록·사용처 정리이며, **Vercel/배포 설정은 배포 단계에서 별도로** 진행하면 됩니다.

---

## 1. 환경 변수 목록 (최종)

| 변수명 | 필수 여부 | 사용처 (파일) | 용도 |
|--------|-----------|----------------|------|
| **DATABASE_URL** | **필수** (DB 사용 시) | `prisma/schema.prisma` (Prisma가 DB 연결에 사용)<br>`lib/db.ts` (PrismaClient 생성 시 내부 사용)<br>로그인·회원가입·마이페이지·대회·관리자 등 모든 DB 접근 | PostgreSQL 연결 문자열. Neon 등 호스트 주소·계정·DB명 포함. |
| **SESSION_SECRET** | **필수** (배포 시) | `lib/auth.ts` (JWT 서명·검증, 쿠키 secure 플래그) | 로그인 세션(JWT) 서명용 비밀키. 32자 이상 랜덤 권장. |
| **BLOB_READ_WRITE_TOKEN** | 선택 | `app/api/mypage/avg-proof/route.ts` (Vercel Blob `put()` 호출 시 SDK가 자동 참조) | 마이페이지 "AVG 증빙 이미지" 업로드 시 필요. 없으면 업로드 실패. |

- **NODE_ENV**: Next.js/Vercel이 자동 설정. 로컬은 `development`, 배포는 `production`. 직접 넣을 필요 없음.

---

## 2. 사용처 상세

### DATABASE_URL
- **prisma/schema.prisma**  
  `datasource db { url = env("DATABASE_URL") }` — 마이그레이션·generate·런타임 DB 연결에 사용.
- **lib/db.ts**  
  PrismaClient가 내부적으로 이 URL로 DB 접속.
- **실제 사용 API/페이지**  
  `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `app/api/mypage/avg-proof/route.ts`, `app/mypage/page.tsx`, `app/admin/*`, `app/tournaments/page.tsx`, `app/tournaments/[id]/page.tsx` 등 DB를 쓰는 모든 경로.

### SESSION_SECRET
- **lib/auth.ts**  
  - `getSessionSecret()`: 프로덕션에서 값 없으면 앱 기동 시 에러 throw.  
  - JWT 서명·검증(`createSession`, `getSession`)에 사용.  
  - `setSessionCookie`에서 `secure: process.env.NODE_ENV === "production"` 판단에 NODE_ENV 사용.

### BLOB_READ_WRITE_TOKEN
- **app/api/mypage/avg-proof/route.ts**  
  `put()` 호출 시 `@vercel/blob` SDK가 `process.env.BLOB_READ_WRITE_TOKEN`을 읽어 Vercel Blob 스토리지에 업로드.  
  없으면 `put()` 호출이 실패하며, API에서 안내 메시지를 반환하도록 처리됨.

---

## 3. 필수 / 선택 구분

| 구분 | 변수 |
|------|------|
| **필수 (배포)** | `DATABASE_URL`, `SESSION_SECRET` — 없으면 로그인·회원가입·세션·DB 기능 불가 또는 앱 기동 실패. |
| **선택** | `BLOB_READ_WRITE_TOKEN` — 마이페이지 AVG 증빙 업로드를 쓸 때만 필요. 업로드 안 쓰면 생략 가능. |

---

## 4. Vercel에 넣어야 할 값 (초보자용)

### 4.1 어디에 넣나요?
1. [Vercel](https://vercel.com) 로그인 후 해당 **프로젝트** 선택  
2. 상단 **Settings** → 왼쪽 **Environment Variables**  
3. **Key**(변수명) / **Value**(값) 입력 후 **Save**  
4. **Environment**는 보통 **Production**, **Preview**, **Development** 모두 체크해 두면 됨.

### 4.2 넣을 값 목록

#### ① DATABASE_URL (필수)
- **Key:** `DATABASE_URL`
- **Value:** PostgreSQL 연결 문자열  
  - 예: Neon 사용 시  
    `postgresql://사용자명:비밀번호@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`  
  - Neon 콘솔(https://console.neon.tech) → 프로젝트 → Connection string 복사 후 그대로 붙여넣기.

#### ② SESSION_SECRET (필수)
- **Key:** `SESSION_SECRET`
- **Value:** 32자 이상 임의 문자열 (영문·숫자 조합 권장).  
  - 예시 생성 (로컬 터미널):  
    `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`  
  - 나온 값을 그대로 복사해 Value에 붙여넣기.

#### ③ Web Push (선택, 대회 알림 푸시용)
- **Key:** `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (또는 `VAPID_PUBLIC_KEY`)
- **Value:** `npx web-push generate-vapid-keys` 로 생성한 키 쌍. 푸시 미사용 시 생략 가능.

#### ④ 경기장 안내 Cron (선택)
- **Key:** `CRON_SECRET`
- **Value:** `/api/cron/venue-reminder` 호출 시 `Authorization: Bearer <값>` 또는 `X-Cron-Secret: <값>` 으로 전달할 비밀값.

#### ⑤ BLOB_READ_WRITE_TOKEN (선택, AVG 증빙 업로드용)
- **Key:** `BLOB_READ_WRITE_TOKEN`
- **Value:** Vercel 대시보드 → **Storage** → **Blob** 생성 후, 해당 스토어의 **`.env.local`** 또는 Storage 설정에 나오는 `BLOB_READ_WRITE_TOKEN` 값을 복사해 넣기.

### 4.3 저장 후
- **Redeploy** 한 번 하면 새 env가 적용됩니다.  
- 이미 배포된 상태라면: **Deployments** → 최신 배포 옆 **⋯** → **Redeploy** 실행.

---

## 5. 로컬 개발 시

- 프로젝트 루트에 `.env` 파일을 만들고 위 변수들을 넣으면 됩니다.  
- `.env.example`을 복사해 `.env`로 만든 뒤, 실제 값으로 채우면 됨.  
- `.env`는 Git에 올리지 마세요 (이미 .gitignore에 있을 수 있음).
