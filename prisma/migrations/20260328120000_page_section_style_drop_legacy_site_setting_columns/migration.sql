-- PageSection: 섹션 스타일 JSON
ALTER TABLE "PageSection" ADD COLUMN IF NOT EXISTS "sectionStyleJson" TEXT;

-- SiteSetting: 레거시 히어로/배너 컬럼 제거 (히어로는 heroSettingsJson 단일)
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "heroImageUrl";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "heroTitle";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "heroDescription";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "heroLinkUrl";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "introImageUrl";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "featuredBannerImageUrl";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "featuredBannerLinkUrl";
