-- Tournament / Organization: schema.prisma에 있으나 기존 마이그레이션에서 추가되지 않은 컬럼 보완 (P2022 방지)
-- PostgreSQL: ADD COLUMN IF NOT EXISTS (PG11+)

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "membershipExpireDate" TIMESTAMP(3);

ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "posterImageUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "venueName" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "entryFee" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "prizeInfo" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "qualification" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "approvalType" TEXT NOT NULL DEFAULT 'HOST_APPROVAL';
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "isPromoted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "promotionLevel" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "promotionEndDate" TIMESTAMP(3);

-- FK for createdByUserId (User.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Tournament_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
