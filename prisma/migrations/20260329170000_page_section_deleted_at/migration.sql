-- PageSection 소프트 삭제. 이 컬럼에 대한 유일한 ADD COLUMN 마이그레이션(중복 추가 금지 — prisma/migrations/MIGRATION_POLICY.md 참고).
-- AlterTable
ALTER TABLE "PageSection" ADD COLUMN "deletedAt" TIMESTAMP(3);
