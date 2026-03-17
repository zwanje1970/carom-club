-- AlterTable: Tournament only. Organization.promoPdfUrl/promoImageUrl are in 20260405000000_organization_promo_columns
-- (Organization may not exist in shadow DB at this migration name order in some environments; avoid ALTER here.)
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "outlinePdfUrl" TEXT;
