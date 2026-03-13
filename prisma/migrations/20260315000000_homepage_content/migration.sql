-- Create SiteSetting if missing (required before adding columns)
CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL DEFAULT 'CAROM.CLUB',
    "siteDescription" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#d97706',
    "secondaryColor" TEXT NOT NULL DEFAULT '#b91c1c',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- Homepage content fields on SiteSetting (Hero, intro image, featured banner)
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "heroTitle" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "heroDescription" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "heroLinkUrl" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "introImageUrl" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "featuredBannerImageUrl" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "featuredBannerLinkUrl" TEXT;
