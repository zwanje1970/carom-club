-- AlterTable: 메인 히어로 전용 설정 (JSON)
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "heroSettingsJson" TEXT;
