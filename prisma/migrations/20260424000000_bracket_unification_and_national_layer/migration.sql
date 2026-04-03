-- Draft migration: bracket unification + national tournament operating layer
-- This file is intentionally conservative: nullable additions first, then new tables.

CREATE TYPE "TournamentType" AS ENUM ('NORMAL', 'NATIONAL');
CREATE TYPE "TournamentRecruitmentStatus" AS ENUM (
  'DRAFT',
  'RECRUITING',
  'WAITLIST_OPEN',
  'RECRUIT_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);
CREATE TYPE "BracketMode" AS ENUM ('SINGLE_ELIM');
CREATE TYPE "BracketSeedingMode" AS ENUM ('RANDOM', 'LEVEL_BASED', 'MANUAL');
CREATE TYPE "ByeStrategy" AS ENUM ('EARLY', 'ROUND_BASED');
CREATE TYPE "ClientMembershipRole" AS ENUM ('MEMBER', 'CLIENT_ADMIN', 'ZONE_MANAGER');
CREATE TYPE "ClientMembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "BracketKind" AS ENUM ('MAIN', 'ZONE', 'FINAL');
CREATE TYPE "BracketStatus" AS ENUM ('DRAFT', 'GENERATED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "BracketMatchStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TournamentEntryStatus" AS ENUM (
  'APPLIED',
  'CONFIRMED',
  'WAITLIST',
  'ELIMINATED',
  'QUALIFIED',
  'AUTO_EXCLUDED',
  'WITHDRAWN',
  'NO_SHOW'
);
CREATE TYPE "TournamentZoneStatus" AS ENUM ('READY', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ZoneManagerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'INVITED', 'JOINED', 'SKIPPED', 'CANCELLED');

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "type" "TournamentType" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "recruitmentStatus" "TournamentRecruitmentStatus" NOT NULL DEFAULT 'RECRUITING',
  ADD COLUMN IF NOT EXISTS "bracketMode" "BracketMode" NOT NULL DEFAULT 'SINGLE_ELIM',
  ADD COLUMN IF NOT EXISTS "seedingMode" "BracketSeedingMode" NOT NULL DEFAULT 'RANDOM',
  ADD COLUMN IF NOT EXISTS "byeStrategy" "ByeStrategy" NOT NULL DEFAULT 'EARLY',
  ADD COLUMN IF NOT EXISTS "targetFinalSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "duplicateApplyAllowed" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "recruitOpenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recruitCloseAt" TIMESTAMP(3);

ALTER TABLE "TournamentEntry"
  ADD COLUMN IF NOT EXISTS "matchDayId" TEXT,
  ADD COLUMN IF NOT EXISTS "zoneId" TEXT,
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "levelCode" TEXT,
  ADD COLUMN IF NOT EXISTS "levelConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "entryStatus" "TournamentEntryStatus" NOT NULL DEFAULT 'APPLIED',
  ADD COLUMN IF NOT EXISTS "isWaitlist" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "duplicateGroupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "seedNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "bracketOrder" INTEGER;

ALTER TABLE "TournamentZone"
  ADD COLUMN IF NOT EXISTS "matchDayId" TEXT,
  ADD COLUMN IF NOT EXISTS "venueId" TEXT,
  ADD COLUMN IF NOT EXISTS "workflowStatus" "TournamentZoneStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS "qualifierTarget" INTEGER;

CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "defaultTableCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Client_slug_key" ON "Client"("slug");

CREATE TABLE IF NOT EXISTS "TournamentClientMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "role" "ClientMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "status" "ClientMembershipStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentClientMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentClientMembership_userId_clientId_key" ON "TournamentClientMembership"("userId", "clientId");
CREATE INDEX IF NOT EXISTS "TournamentClientMembership_clientId_idx" ON "TournamentClientMembership"("clientId");
CREATE INDEX IF NOT EXISTS "TournamentClientMembership_userId_idx" ON "TournamentClientMembership"("userId");

CREATE TABLE IF NOT EXISTS "TournamentMatchDay" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentMatchDay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TournamentMatchDay_tournamentId_idx" ON "TournamentMatchDay"("tournamentId");
CREATE INDEX IF NOT EXISTS "TournamentMatchDay_tournamentId_sortOrder_idx" ON "TournamentMatchDay"("tournamentId", "sortOrder");

CREATE TABLE IF NOT EXISTS "Venue" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "tournamentId" TEXT,
  "name" TEXT NOT NULL,
  "tableCount" INTEGER NOT NULL DEFAULT 1,
  "address" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Venue_clientId_idx" ON "Venue"("clientId");
CREATE INDEX IF NOT EXISTS "Venue_tournamentId_idx" ON "Venue"("tournamentId");
CREATE INDEX IF NOT EXISTS "Venue_clientId_sortOrder_idx" ON "Venue"("clientId", "sortOrder");

CREATE TABLE IF NOT EXISTS "TournamentZoneManager" (
  "id" TEXT NOT NULL,
  "zoneId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentZoneManager_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentZoneManager_zoneId_userId_key" ON "TournamentZoneManager"("zoneId", "userId");
CREATE INDEX IF NOT EXISTS "TournamentZoneManager_zoneId_idx" ON "TournamentZoneManager"("zoneId");
CREATE INDEX IF NOT EXISTS "TournamentZoneManager_userId_idx" ON "TournamentZoneManager"("userId");

CREATE TABLE IF NOT EXISTS "ZoneManagerApplication" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "zoneId" TEXT,
  "userId" TEXT NOT NULL,
  "status" "ZoneManagerApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ZoneManagerApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ZoneManagerApplication_tournamentId_idx" ON "ZoneManagerApplication"("tournamentId");
CREATE INDEX IF NOT EXISTS "ZoneManagerApplication_zoneId_idx" ON "ZoneManagerApplication"("zoneId");
CREATE INDEX IF NOT EXISTS "ZoneManagerApplication_userId_idx" ON "ZoneManagerApplication"("userId");

CREATE TABLE IF NOT EXISTS "TournamentWaitlistEntry" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "matchDayId" TEXT,
  "zoneId" TEXT,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "levelCode" TEXT,
  "priorityOrder" INTEGER NOT NULL,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "invitedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentWaitlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TournamentWaitlistEntry_tournamentId_idx" ON "TournamentWaitlistEntry"("tournamentId");
CREATE INDEX IF NOT EXISTS "TournamentWaitlistEntry_tournamentId_zoneId_idx" ON "TournamentWaitlistEntry"("tournamentId", "zoneId");
CREATE INDEX IF NOT EXISTS "TournamentWaitlistEntry_tournamentId_priorityOrder_idx" ON "TournamentWaitlistEntry"("tournamentId", "priorityOrder");

CREATE TABLE IF NOT EXISTS "Bracket" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "zoneId" TEXT,
  "kind" "BracketKind" NOT NULL,
  "status" "BracketStatus" NOT NULL DEFAULT 'DRAFT',
  "seedingMode" "BracketSeedingMode" NOT NULL DEFAULT 'RANDOM',
  "byeStrategy" "ByeStrategy" NOT NULL DEFAULT 'EARLY',
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Bracket_tournamentId_zoneId_kind_key" ON "Bracket"("tournamentId", "zoneId", "kind");
CREATE INDEX IF NOT EXISTS "Bracket_tournamentId_idx" ON "Bracket"("tournamentId");
CREATE INDEX IF NOT EXISTS "Bracket_zoneId_idx" ON "Bracket"("zoneId");

CREATE TABLE IF NOT EXISTS "BracketRound" (
  "id" TEXT NOT NULL,
  "bracketId" TEXT NOT NULL,
  "matchDayId" TEXT,
  "roundNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "targetSize" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BracketRound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BracketRound_bracketId_roundNumber_key" ON "BracketRound"("bracketId", "roundNumber");
CREATE INDEX IF NOT EXISTS "BracketRound_bracketId_idx" ON "BracketRound"("bracketId");
CREATE INDEX IF NOT EXISTS "BracketRound_matchDayId_idx" ON "BracketRound"("matchDayId");

CREATE TABLE IF NOT EXISTS "BracketMatch" (
  "id" TEXT NOT NULL,
  "bracketId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "venueId" TEXT,
  "matchNumber" INTEGER NOT NULL,
  "tableOrder" INTEGER,
  "displayOrder" INTEGER,
  "entryIdA" TEXT,
  "entryIdB" TEXT,
  "winnerEntryId" TEXT,
  "scoreA" INTEGER,
  "scoreB" INTEGER,
  "status" "BracketMatchStatus" NOT NULL DEFAULT 'PENDING',
  "isBye" BOOLEAN NOT NULL DEFAULT FALSE,
  "isReduction" BOOLEAN NOT NULL DEFAULT FALSE,
  "isManualOverride" BOOLEAN NOT NULL DEFAULT FALSE,
  "nextMatchId" TEXT,
  "nextSlot" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BracketMatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BracketMatch_bracketId_roundId_matchNumber_idx" ON "BracketMatch"("bracketId", "roundId", "matchNumber");
CREATE INDEX IF NOT EXISTS "BracketMatch_venueId_idx" ON "BracketMatch"("venueId");
CREATE INDEX IF NOT EXISTS "BracketMatch_nextMatchId_idx" ON "BracketMatch"("nextMatchId");

CREATE TABLE IF NOT EXISTS "BracketAuditLog" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "bracketId" TEXT,
  "matchId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BracketAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BracketAuditLog_tournamentId_idx" ON "BracketAuditLog"("tournamentId");
CREATE INDEX IF NOT EXISTS "BracketAuditLog_bracketId_idx" ON "BracketAuditLog"("bracketId");
CREATE INDEX IF NOT EXISTS "BracketAuditLog_matchId_idx" ON "BracketAuditLog"("matchId");
CREATE INDEX IF NOT EXISTS "BracketAuditLog_actorUserId_createdAt_idx" ON "BracketAuditLog"("actorUserId", "createdAt");

ALTER TABLE "Tournament"
  ADD CONSTRAINT "Tournament_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentEntry"
  ADD CONSTRAINT "TournamentEntry_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "TournamentMatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentEntry_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TournamentZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentZone"
  ADD CONSTRAINT "TournamentZone_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "TournamentMatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentZone_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentClientMembership"
  ADD CONSTRAINT "TournamentClientMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentClientMembership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentMatchDay"
  ADD CONSTRAINT "TournamentMatchDay_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Venue"
  ADD CONSTRAINT "Venue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Venue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentZoneManager"
  ADD CONSTRAINT "TournamentZoneManager_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TournamentZone"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentZoneManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentZoneManager_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ZoneManagerApplication"
  ADD CONSTRAINT "ZoneManagerApplication_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ZoneManagerApplication_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TournamentZone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ZoneManagerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ZoneManagerApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentWaitlistEntry"
  ADD CONSTRAINT "TournamentWaitlistEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentWaitlistEntry_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "TournamentMatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentWaitlistEntry_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TournamentZone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TournamentWaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bracket"
  ADD CONSTRAINT "Bracket_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Bracket_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TournamentZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BracketRound"
  ADD CONSTRAINT "BracketRound_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketRound_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "TournamentMatchDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BracketMatch"
  ADD CONSTRAINT "BracketMatch_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BracketRound"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketMatch_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketMatch_entryIdA_fkey" FOREIGN KEY ("entryIdA") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketMatch_entryIdB_fkey" FOREIGN KEY ("entryIdB") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketMatch_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketMatch_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "BracketMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BracketAuditLog"
  ADD CONSTRAINT "BracketAuditLog_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketAuditLog_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketAuditLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "BracketMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BracketAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

