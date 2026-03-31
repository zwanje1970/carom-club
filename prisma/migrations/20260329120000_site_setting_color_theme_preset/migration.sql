-- 색상 테마 프리셋 (관리자 > 사이트관리 > 색상 테마)
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "colorThemePreset" TEXT;
