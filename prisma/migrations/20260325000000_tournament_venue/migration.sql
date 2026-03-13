-- CreateTable
CREATE TABLE "TournamentVenue" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentVenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentVenue_tournamentId_organizationId_key" ON "TournamentVenue"("tournamentId", "organizationId");

-- CreateIndex
CREATE INDEX "TournamentVenue_tournamentId_idx" ON "TournamentVenue"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentVenue_organizationId_idx" ON "TournamentVenue"("organizationId");

-- AddForeignKey
ALTER TABLE "TournamentVenue" ADD CONSTRAINT "TournamentVenue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentVenue" ADD CONSTRAINT "TournamentVenue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
