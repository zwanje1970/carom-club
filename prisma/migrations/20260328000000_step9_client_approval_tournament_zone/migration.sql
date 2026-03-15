-- CreateTable ClientApplication (9단계: 최초 생성이 누락되어 있어 여기서 생성 후 ALTER)
-- shadow DB는 빈 DB이므로 ALTER만 있으면 실패함. CREATE TABLE IF NOT EXISTS로 보완.
CREATE TABLE IF NOT EXISTS "ClientApplication" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "applicantUserId" TEXT,
    "organizationName" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "region" TEXT,
    "shortDescription" TEXT,
    "referenceLink" TEXT,
    "rejectedReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientApplication_status_idx" ON "ClientApplication"("status");
CREATE INDEX IF NOT EXISTS "ClientApplication_applicantUserId_idx" ON "ClientApplication"("applicantUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClientApplication_applicantUserId_fkey'
  ) THEN
    ALTER TABLE "ClientApplication" ADD CONSTRAINT "ClientApplication_applicantUserId_fkey"
      FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable ClientApplication: requestedClientType, reviewedByUserId (9단계)
ALTER TABLE "ClientApplication" ADD COLUMN IF NOT EXISTS "requestedClientType" TEXT DEFAULT 'GENERAL';
ALTER TABLE "ClientApplication" ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT;

-- CreateTable Zone (9단계: TournamentZone FK 참조를 위해 최초 생성이 누락된 테이블 보완)
CREATE TABLE IF NOT EXISTS "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable TournamentZone (대회-권역 연결, 9단계)
CREATE TABLE "TournamentZone" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentZone_tournamentId_zoneId_key" ON "TournamentZone"("tournamentId", "zoneId");
CREATE INDEX "TournamentZone_tournamentId_idx" ON "TournamentZone"("tournamentId");
CREATE INDEX "TournamentZone_zoneId_idx" ON "TournamentZone"("zoneId");

-- AddForeignKey
ALTER TABLE "TournamentZone" ADD CONSTRAINT "TournamentZone_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentZone" ADD CONSTRAINT "TournamentZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
