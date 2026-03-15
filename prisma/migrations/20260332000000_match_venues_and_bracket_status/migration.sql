-- CreateTable: 당구장 대회 MVP 경기장 슬롯
CREATE TABLE IF NOT EXISTS "TournamentMatchVenue" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "venueNumber" INTEGER NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "venueName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentMatchVenue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentMatchVenue_tournamentId_venueNumber_key" ON "TournamentMatchVenue"("tournamentId", "venueNumber");
CREATE INDEX IF NOT EXISTS "TournamentMatchVenue_tournamentId_idx" ON "TournamentMatchVenue"("tournamentId");

ALTER TABLE "TournamentMatchVenue" ADD CONSTRAINT "TournamentMatchVenue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
