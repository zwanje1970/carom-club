-- AlterTable: TournamentFinalMatch — 라운드·경기장 FK, 본선/예선 구분
ALTER TABLE "TournamentFinalMatch" ADD COLUMN IF NOT EXISTS "tournamentRoundId" TEXT;
ALTER TABLE "TournamentFinalMatch" ADD COLUMN IF NOT EXISTS "matchVenueId" TEXT;
ALTER TABLE "TournamentFinalMatch" ADD COLUMN IF NOT EXISTS "bracketPhase" TEXT NOT NULL DEFAULT 'MAIN';

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentFinalMatch_tournamentRoundId_fkey'
  ) THEN
    ALTER TABLE "TournamentFinalMatch"
      ADD CONSTRAINT "TournamentFinalMatch_tournamentRoundId_fkey"
      FOREIGN KEY ("tournamentRoundId") REFERENCES "TournamentRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentFinalMatch_matchVenueId_fkey'
  ) THEN
    ALTER TABLE "TournamentFinalMatch"
      ADD CONSTRAINT "TournamentFinalMatch_matchVenueId_fkey"
      FOREIGN KEY ("matchVenueId") REFERENCES "TournamentMatchVenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TournamentFinalMatch_tournamentRoundId_idx" ON "TournamentFinalMatch"("tournamentRoundId");
CREATE INDEX IF NOT EXISTS "TournamentFinalMatch_matchVenueId_idx" ON "TournamentFinalMatch"("matchVenueId");
CREATE INDEX IF NOT EXISTS "TournamentFinalMatch_tournamentId_bracketPhase_roundIndex_matchIndex_idx"
  ON "TournamentFinalMatch"("tournamentId", "bracketPhase", "roundIndex", "matchIndex");
