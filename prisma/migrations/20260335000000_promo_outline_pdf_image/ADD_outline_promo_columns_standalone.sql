-- Run this in Neon SQL Editor (or psql) if migration 20260335000000 was not applied.
-- Adds: Tournament.outlinePdfUrl, Organization.promoPdfUrl, Organization.promoImageUrl

-- AlterTable Tournament
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "outlinePdfUrl" TEXT;

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "promoPdfUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "promoImageUrl" TEXT;
