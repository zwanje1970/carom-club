-- 메인 캐러셀: 간격(초) 컬럼이 있으면 흐름 속도(1~100)로 이전 후 제거
ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "homeCarouselFlowSpeed" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SiteSetting' AND column_name = 'homeListCarouselIntervalSec'
  ) THEN
    UPDATE "SiteSetting" SET "homeCarouselFlowSpeed" = LEAST(
      100,
      GREATEST(
        1,
        COALESCE((120 / NULLIF("homeListCarouselIntervalSec", 0))::int, 50)
      )
    );
    ALTER TABLE "SiteSetting" DROP COLUMN "homeListCarouselIntervalSec";
  END IF;
END $$;

UPDATE "SiteSetting" SET "homeCarouselFlowSpeed" = 50 WHERE "homeCarouselFlowSpeed" IS NULL;
ALTER TABLE "SiteSetting" ALTER COLUMN "homeCarouselFlowSpeed" SET DEFAULT 50;
ALTER TABLE "SiteSetting" ALTER COLUMN "homeCarouselFlowSpeed" SET NOT NULL;
