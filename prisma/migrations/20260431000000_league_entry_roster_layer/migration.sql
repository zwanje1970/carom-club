CREATE TYPE "LeagueEntryStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'EXCLUDED');

CREATE TABLE IF NOT EXISTS "LeagueEntry" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "tournamentEntryId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "levelCode" TEXT,
    "seedNumber" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "LeagueEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAutoRegistered" BOOLEAN NOT NULL DEFAULT FALSE,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeagueEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeagueEntry_leagueId_tournamentEntryId_key"
  ON "LeagueEntry"("leagueId", "tournamentEntryId");
CREATE INDEX IF NOT EXISTS "LeagueEntry_leagueId_idx"
  ON "LeagueEntry"("leagueId");
CREATE INDEX IF NOT EXISTS "LeagueEntry_tournamentEntryId_idx"
  ON "LeagueEntry"("tournamentEntryId");

ALTER TABLE "LeagueEntry"
  ADD CONSTRAINT "LeagueEntry_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueEntry_tournamentEntryId_fkey" FOREIGN KEY ("tournamentEntryId") REFERENCES "TournamentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueMatch"
  ADD COLUMN IF NOT EXISTS "leagueEntryIdA" TEXT,
  ADD COLUMN IF NOT EXISTS "leagueEntryIdB" TEXT,
  ADD COLUMN IF NOT EXISTS "winnerLeagueEntryId" TEXT,
  ADD COLUMN IF NOT EXISTS "isForcedZeroPoint" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "League"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LeagueMatch_leagueEntryIdA_idx"
  ON "LeagueMatch"("leagueEntryIdA");
CREATE INDEX IF NOT EXISTS "LeagueMatch_leagueEntryIdB_idx"
  ON "LeagueMatch"("leagueEntryIdB");
CREATE INDEX IF NOT EXISTS "LeagueMatch_winnerLeagueEntryId_idx"
  ON "LeagueMatch"("winnerLeagueEntryId");

ALTER TABLE "LeagueMatch"
  ADD CONSTRAINT "LeagueMatch_leagueEntryIdA_fkey" FOREIGN KEY ("leagueEntryIdA") REFERENCES "LeagueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueMatch_leagueEntryIdB_fkey" FOREIGN KEY ("leagueEntryIdB") REFERENCES "LeagueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueMatch_winnerLeagueEntryId_fkey" FOREIGN KEY ("winnerLeagueEntryId") REFERENCES "LeagueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeagueStanding"
  ADD COLUMN IF NOT EXISTS "leagueEntryId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LeagueStanding_leagueId_leagueEntryId_key"
  ON "LeagueStanding"("leagueId", "leagueEntryId");
CREATE INDEX IF NOT EXISTS "LeagueStanding_leagueEntryId_idx"
  ON "LeagueStanding"("leagueEntryId");

ALTER TABLE "LeagueStanding"
  ADD CONSTRAINT "LeagueStanding_leagueEntryId_fkey" FOREIGN KEY ("leagueEntryId") REFERENCES "LeagueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
