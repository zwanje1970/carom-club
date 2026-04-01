DO $$
BEGIN
  CREATE TYPE "DivisionMetricType" AS ENUM ('AVERAGE', 'SCORE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "divisionMetricType" "DivisionMetricType" NOT NULL DEFAULT 'AVERAGE';

ALTER TABLE "TournamentEntry"
  ADD COLUMN IF NOT EXISTS "divisionMatchedValue" DOUBLE PRECISION;

UPDATE "TournamentEntry"
SET "divisionMatchedValue" = COALESCE("divisionMatchedValue", "divisionMatchedAverage")
WHERE true;
