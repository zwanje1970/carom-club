-- Add explicit reduction round type for bracket rounds.
CREATE TYPE "BracketRoundType" AS ENUM ('NORMAL', 'REDUCTION');

ALTER TABLE "BracketRound"
  ADD COLUMN IF NOT EXISTS "roundType" "BracketRoundType" NOT NULL DEFAULT 'NORMAL';
