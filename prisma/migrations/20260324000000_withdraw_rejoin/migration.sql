-- User: 탈퇴 시각 (soft delete)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);

-- SiteSetting: 탈퇴 후 재가입 가능 일수
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "withdrawRejoinDays" INTEGER NOT NULL DEFAULT 0;
