-- Compatibility fields for UI and scheduling on unified BracketMatch

ALTER TABLE "BracketMatch"
  ADD COLUMN IF NOT EXISTS "scheduledStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hasIssue" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "issueNote" TEXT;

