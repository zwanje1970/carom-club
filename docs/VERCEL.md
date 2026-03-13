# Vercel 배포 (Prisma + Neon)

## 필수 환경 변수

Vercel 프로젝트 **Settings → Environment Variables** 에 다음 3개를 설정하세요.

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열 (Prisma 쿼리용). `?sslmode=require` 포함 |
| `DIRECT_URL` | Neon PostgreSQL 직연결 (마이그레이션/ generate용). 보통 `DATABASE_URL` 과 동일 |
| `SESSION_SECRET` | 로그인 세션(JWT) 서명 키. 32자 이상 랜덤 권장 |

자세한 예시는 프로젝트 루트의 `.env.example` 을 참고하세요.

## 빌드

- **Build Command**: `npm run build` (기본값 유지)
- `package.json` 의 `build` 스크립트가 `prisma generate && next build` 로 되어 있어, 빌드 전에 Prisma Client가 자동 생성됩니다.
- `postinstall` 에서도 `prisma generate || true` 가 실행되므로, 의존성 설치 후에도 클라이언트가 생성됩니다.

## 참고

- `.next-cache` 는 `.gitignore` 에 포함되어 있어 저장소에 올라가지 않습니다.
- 빌드가 실패하면 위 세 환경 변수가 모두 설정되었는지 확인하세요.
