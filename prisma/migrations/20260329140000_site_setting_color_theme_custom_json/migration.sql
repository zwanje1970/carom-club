-- 커스텀 색상 테마(프리셋 복제 후 편집) JSON
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "colorThemeCustomJson" TEXT;
