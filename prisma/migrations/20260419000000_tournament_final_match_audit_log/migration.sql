CREATE TABLE IF NOT EXISTS "TournamentFinalMatchAuditLog" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentFinalMatchAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TournamentFinalMatchAuditLog_tournamentId_matchId_idx" ON "TournamentFinalMatchAuditLog"("tournamentId", "matchId");
CREATE INDEX IF NOT EXISTS "TournamentFinalMatchAuditLog_createdAt_idx" ON "TournamentFinalMatchAuditLog"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentFinalMatchAuditLog_tournamentId_fkey'
  ) THEN
    ALTER TABLE "TournamentFinalMatchAuditLog"
      ADD CONSTRAINT "TournamentFinalMatchAuditLog_tournamentId_fkey"
      FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
