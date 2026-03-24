# BilliardNote 테이블이 없을 때

에러: `The table 'public.BilliardNote' does not exist in the current database.`

## 원인

- `prisma migrate status`가 "up to date"인데도 테이블이 없는 경우: 마이그레이션 기록은 있으나 실제 CREATE TABLE이 적용되지 않은 상태(이전 deploy 실패, DB 분기 등).

## 해결

1. **Neon 콘솔** → 해당 프로젝트 DB 선택 → **SQL Editor** 열기.
2. 아래 파일 내용을 복사해 붙여넣고 **Run** 실행.
   - 파일: `prisma/migrations/20260404000000_add_billiard_notes/CREATE_BilliardNote_standalone.sql`
3. 실행 후 `/mypage/notes/new`에서 난구노트 저장이 동작하는지 확인.

## 마이그레이션 기록 정리(선택)

테이블을 위 SQL로 직접 만든 뒤, Prisma 마이그레이션 기록만 맞추고 싶다면:

```bash
npx prisma migrate resolve --applied 20260404000000_add_billiard_notes
```

이후 `prisma migrate status`는 계속 "up to date"로 유지됩니다.
