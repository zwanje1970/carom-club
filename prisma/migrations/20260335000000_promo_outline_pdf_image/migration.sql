-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "promoPdfUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "promoImageUrl" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "outlinePdfUrl" TEXT;
