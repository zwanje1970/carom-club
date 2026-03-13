-- User 테이블에 주소 컬럼 추가 (Prisma schema와 DB 불일치 해결, P2022 방지)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "addressDetail" TEXT;
