-- 데이터 유지: UserRole을 ADMIN → PLATFORM_ADMIN 구조로 변경 (리셋 없음)

-- 1) 새 UserRole enum 생성
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'CLIENT_ADMIN', 'PLATFORM_ADMIN');

-- 2) User 테이블에 임시 컬럼 추가 후 값 이전 (ADMIN → PLATFORM_ADMIN)
ALTER TABLE "User" ADD COLUMN "role_new" "UserRole_new";
UPDATE "User" SET "role_new" = CASE
  WHEN "role"::text = 'ADMIN' THEN 'PLATFORM_ADMIN'::"UserRole_new"
  ELSE "role"::text::"UserRole_new"
END;
ALTER TABLE "User" ALTER COLUMN "role_new" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole_new";

-- 3) 기존 enum 제거 후 새 타입 이름 변경
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
