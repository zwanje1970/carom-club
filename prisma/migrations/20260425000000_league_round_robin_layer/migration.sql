-- Draft migration: league round-robin layer

CREATE TYPE "LeagueKind" AS ENUM ('MAIN', 'ZONE', 'FINAL');
CREATE TYPE "LeagueStatus" AS ENUM ('DRAFT', 'GENERATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "LeagueMatchStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "LeagueTieBreaker" AS ENUM ('HEAD_TO_HEAD', 'SCORE_DIFF', 'SCORE_FOR', 'DRAW_COUNT');

CREATE TABLE IF NOT EXISTS "League" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "zoneId" TEXT,
    "kind" "LeagueKind" NOT NULL,
    "status" "LeagueStatus" NOT NULL DEFAULT 'DRAFT',
    "pointsForWin" INTEGER NOT NULL DEFAULT 3,
    "pointsForDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsForLoss" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" "LeagueTieBreaker" NOT NULL DEFAULT 'HEAD_TO_HEAD',
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "League_tournamentId_zoneId_kind_key" ON "League"("tournamentId", "zoneId", "kind");
CREATE INDEX IF NOT EXISTS "League_tournamentId_idx" ON "League"("tournamentId");
CREATE INDEX IF NOT EXISTS "League_zoneId_idx" ON "League"("zoneId");

CREATE TABLE IF NOT EXISTS "LeagueRound" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "matchDayId" TEXT,
    "roundNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeagueRound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeagueRound_leagueId_roundNumber_key" ON "LeagueRound"("leagueId", "roundNumber");
CREATE INDEX IF NOT EXISTS "LeagueRound_leagueId_idx" ON "LeagueRound"("leagueId");
CREATE INDEX IF NOT EXISTS "LeagueRound_matchDayId_idx" ON "LeagueRound"("matchDayId");

CREATE TABLE IF NOT EXISTS "LeagueMatch" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "venueId" TEXT,
    "matchNumber" INTEGER NOT NULL,
    "tableOrder" INTEGER,
    "displayOrder" INTEGER,
    "entryIdA" TEXT,
    "entryIdB" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "status" "LeagueMatchStatus" NOT NULL DEFAULT 'PENDING',
    "isWalkover" BOOLEAN NOT NULL DEFAULT FALSE,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT FALSE,
    "scheduledStartAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeagueMatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeagueMatch_leagueId_roundId_matchNumber_idx" ON "LeagueMatch"("leagueId", "roundId", "matchNumber");
CREATE INDEX IF NOT EXISTS "LeagueMatch_venueId_idx" ON "LeagueMatch"("venueId");

CREATE TABLE IF NOT EXISTS "LeagueStanding" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "drawn" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "scoreFor" INTEGER NOT NULL DEFAULT 0,
    "scoreAgainst" INTEGER NOT NULL DEFAULT 0,
    "scoreDiff" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueStanding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeagueStanding_leagueId_entryId_key" ON "LeagueStanding"("leagueId", "entryId");
CREATE INDEX IF NOT EXISTS "LeagueStanding_leagueId_idx" ON "LeagueStanding"("leagueId");
CREATE INDEX IF NOT EXISTS "LeagueStanding_entryId_idx" ON "LeagueStanding"("entryId");

CREATE TABLE IF NOT EXISTS "LeagueAuditLog" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "leagueId" TEXT,
    "matchId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeagueAuditLog_tournamentId_idx" ON "LeagueAuditLog"("tournamentId");
CREATE INDEX IF NOT EXISTS "LeagueAuditLog_leagueId_idx" ON "LeagueAuditLog"("leagueId");
CREATE INDEX IF NOT EXISTS "LeagueAuditLog_matchId_idx" ON "LeagueAuditLog"("matchId");
CREATE INDEX IF NOT EXISTS "LeagueAuditLog_actorUserId_createdAt_idx" ON "LeagueAuditLog"("actorUserId", "createdAt");

ALTER TABLE "League"
  ADD CONSTRAINT "League_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "League_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TournamentZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeagueRound"
  ADD CONSTRAINT "LeagueRound_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueRound_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "TournamentMatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeagueMatch"
  ADD CONSTRAINT "LeagueMatch_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LeagueRound"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueMatch_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueMatch_entryIdA_fkey" FOREIGN KEY ("entryIdA") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueMatch_entryIdB_fkey" FOREIGN KEY ("entryIdB") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeagueStanding"
  ADD CONSTRAINT "LeagueStanding_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueStanding_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TournamentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueAuditLog"
  ADD CONSTRAINT "LeagueAuditLog_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueAuditLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueAuditLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "LeagueMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LeagueAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

