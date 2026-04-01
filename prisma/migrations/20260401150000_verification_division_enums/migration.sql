-- verification/division 표준화 + 구 certification 필드 호환 유지

DO $$
BEGIN
  CREATE TYPE "VerificationMode" AS ENUM ('NONE', 'AUTO', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "EligibilityType" AS ENUM ('NONE', 'UNDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "VerificationOcrStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "VerificationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "verificationMode" "VerificationMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "verificationReviewRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "eligibilityType" "EligibilityType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "eligibilityValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "verificationGuideText" TEXT,
  ADD COLUMN IF NOT EXISTS "divisionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "divisionRulesJson" JSONB;

ALTER TABLE "TournamentEntry"
  ADD COLUMN IF NOT EXISTS "verificationImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationOcrText" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationOcrStatus" "VerificationOcrStatus",
  ADD COLUMN IF NOT EXISTS "verificationReviewStatus" "VerificationReviewStatus",
  ADD COLUMN IF NOT EXISTS "divisionName" TEXT,
  ADD COLUMN IF NOT EXISTS "divisionMatchedAverage" DOUBLE PRECISION;

-- Tournament: 구 필드 -> 신규 필드 백필
UPDATE "Tournament"
SET
  "verificationMode" = CASE COALESCE("certificationRequestMode", 'NONE')
    WHEN 'AUTO' THEN 'AUTO'::"VerificationMode"
    WHEN 'MANUAL' THEN 'MANUAL'::"VerificationMode"
    ELSE 'NONE'::"VerificationMode"
  END,
  "verificationReviewRequired" = COALESCE("manualReviewRequired", true),
  "eligibilityType" = CASE COALESCE("eligibilityLimitType", 'NONE')
    WHEN 'UNDER' THEN 'UNDER'::"EligibilityType"
    ELSE 'NONE'::"EligibilityType"
  END,
  "eligibilityValue" = CASE
    WHEN COALESCE("eligibilityLimitType", 'NONE') = 'UNDER' THEN "eligibilityLimitValue"
    ELSE NULL
  END
WHERE true;

-- Entry: 구 필드 -> 신규 필드 백필
UPDATE "TournamentEntry"
SET
  "verificationImageUrl" = COALESCE("verificationImageUrl", "certificationImageUrl"),
  "verificationOcrText" = COALESCE("verificationOcrText", "certificationOcrText"),
  "verificationOcrStatus" = COALESCE(
    "verificationOcrStatus",
    CASE COALESCE("certificationOcrStatus", '')
      WHEN 'pending' THEN 'PENDING'::"VerificationOcrStatus"
      WHEN 'success' THEN 'SUCCESS'::"VerificationOcrStatus"
      WHEN 'failed' THEN 'FAILED'::"VerificationOcrStatus"
      WHEN 'skipped' THEN 'SKIPPED'::"VerificationOcrStatus"
      ELSE NULL
    END
  ),
  "verificationReviewStatus" = COALESCE(
    "verificationReviewStatus",
    CASE COALESCE("certificationReviewStatus", '')
      WHEN 'pending' THEN 'PENDING'::"VerificationReviewStatus"
      WHEN 'approved' THEN 'APPROVED'::"VerificationReviewStatus"
      WHEN 'rejected' THEN 'REJECTED'::"VerificationReviewStatus"
      ELSE NULL
    END
  )
WHERE true;
