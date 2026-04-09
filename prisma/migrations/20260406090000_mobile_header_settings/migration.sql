ALTER TABLE "SiteSetting"
  ADD COLUMN IF NOT EXISTS "mobileHeaderBgColor" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileHeaderTextColor" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileHeaderActiveColor" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileHeaderLogoText" TEXT;

