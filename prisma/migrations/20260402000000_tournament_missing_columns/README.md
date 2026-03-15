# Tournament 누락 컬럼 마이그레이션 (P2022 대응)

스키마에는 있으나 기존 마이그레이션에서 추가되지 않은 `Tournament` 컬럼을 추가합니다.

**DB가 이미 사용 중이어서 `prisma migrate deploy`가 P3005로 실패하는 경우:**

1. Neon 대시보드 또는 `psql`로 DB에 접속한 뒤 `migration.sql` 내용을 **직접 실행**합니다.
2. (선택) 마이그레이션 기록만 남기려면:
   ```sql
   INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
   VALUES (gen_random_uuid(), '', NOW(), '20260402000000_tournament_missing_columns', NULL, NULL, NOW(), 1);
   ```
3. `npx prisma generate`로 클라이언트 재생성 (dev 서버 중지 후 실행 권장).

이후 POST /api/admin/tournaments 요청이 500 없이 동작하는지 확인하세요.
