-- 대회 인증파일 요청·참가 제한 + 참가 신청 인증/OCR/검토 필드
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "certificationRequestMode" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "manualReviewRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "eligibilityLimitType" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "eligibilityLimitValue" DOUBLE PRECISION;

ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationImageUrl" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationOriginalFilename" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationMimeType" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationOcrText" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationOcrStatus" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationReviewStatus" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationReviewedAt" TIMESTAMP(3);
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "certificationReviewedById" TEXT;
