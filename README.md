# CAROM.CLUB

당구 대회와 커뮤니티 플랫폼.

## 로컬 개발 (SQLite, Docker 불필요)

로컬에서는 **SQLite**로 입력/저장/조회가 모두 동작합니다. Neon·PostgreSQL은 나중에 연결할 때 사용하면 됩니다.

### 1. 환경 변수

`.env` 예시는 `.env.example`을 참고합니다.

- `DATABASE_URL="file:./dev.db"` — 로컬 SQLite (기본값, `prisma/dev.db` 생성)
- `SESSION_SECRET` — 로그인 세션용. 32자 이상 랜덤 권장.

### 2. DB 생성 (최초 1회)

```bash
npx prisma generate
npx prisma db push
```

(또는 `npm run db:generate` 후 `npm run db:push`)

### 3. 시드 데이터 (선택)

```bash
npm run db:seed
```

관리자 계정(admin / admin1234)과 기본 당구장이 생성됩니다.

### 4. 개발 서버

```bash
npm run dev
```

이후 클라이언트 신청·관리자 저장·마이페이지 조회 등이 모두 로컬 `dev.db`에 저장·조회됩니다.

---

## 나중에 Neon(PostgreSQL) 연결 시

1. `prisma/schema.prisma`에서 `provider = "sqlite"` → `provider = "postgresql"`, `url = env("DATABASE_URL")` 유지.
2. `.env`에 Neon 연결 문자열 설정: `DATABASE_URL="postgresql://...?sslmode=require"`, `DIRECT_URL="postgresql://...?sslmode=require"`
3. 개발 서버 중지 후 `npx prisma generate` → `npx prisma migrate dev` 실행.
4. `npm run dev` 로 서버 다시 실행.

**"데이터베이스가 연결되지 않았습니다" 오류 시** → [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) 에서 단계별 해결 방법을 확인하세요.

(로컬 PostgreSQL을 쓰려면 `docker-compose.yml`로 컨테이너를 띄운 뒤 `DATABASE_URL`을 로컬 URL로 설정할 수 있습니다. 로컬 개발 기본은 SQLite입니다.)

## 기타

- `npm run build` — Prisma generate + Next 빌드
- `npm run lint` — ESLint

## 난구 경로 / 1목 E2E · QA

Playwright로 **경로선·1목** UI를 검증합니다.

```bash
npx playwright install chromium   # 최초 1회
npm run dev                       # 터미널 1
# 터미널 2 (PowerShell): $env:PLAYWRIGHT_SKIP_WEBSERVER='1'; npm run test:e2e
```

- **실행 방법·배포 환경변수·수동 체크리스트·장애 시 확인 순서:** [`docs/QA-TROUBLE-PATH.md`](docs/QA-TROUBLE-PATH.md)
- **fixture·PLAYWRIGHT_BASE_URL:** [`e2e/README.md`](e2e/README.md)
