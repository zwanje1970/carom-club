-- AlterTable Organization: promo PDF/이미지 (20260335000000에서 분리하여 Organization 확정 후 적용)
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "promoPdfUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "promoImageUrl" TEXT;
