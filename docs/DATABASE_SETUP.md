# 데이터베이스 연결 안내

## 문제

`DATABASE_URL` / `DIRECT_URL` 환경변수 미설정 또는 Prisma 재생성 미실행으로  
"데이터베이스가 연결되지 않았습니다" 오류가 발생하는 경우.

## 해결 순서

### 1. 개발 서버 중지

터미널에서 **Ctrl + C** 로 `npm run dev` 를 중지합니다.

### 2. .env 확인

프로젝트 **루트** 의 `.env` 파일을 엽니다.

아래 두 줄이 **반드시** 존재해야 합니다.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
```

- **Neon 콘솔** → **Connect** → 연결 문자열 복사 후 `USER`, `PASSWORD`, `HOST` 등을 본인 값으로 채웁니다.
- `DATABASE_URL` 과 `DIRECT_URL` 에 동일한 연결 문자열을 넣으면 됩니다.

### 3. Prisma 재생성

터미널에서 실행합니다.

```bash
npx prisma generate
```

### 4. 마이그레이션 실행

```bash
npx prisma migrate dev
```

(마이그레이션 이름을 묻면 입력하거나 Enter 로 기본값 사용)

### 5. 서버 다시 실행

```bash
npm run dev
```

이후 브라우저에서 다시 시도하면 DB 연결이 정상 동작합니다.
