-- CreateTable
CREATE TABLE "TournamentSettlement" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentSettlement_tournamentId_key" ON "TournamentSettlement"("tournamentId");

CREATE TABLE "TournamentSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT,
    "flow" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentSettlementLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentSettlementLine_settlementId_idx" ON "TournamentSettlementLine"("settlementId");

ALTER TABLE "TournamentSettlement" ADD CONSTRAINT "TournamentSettlement_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentSettlementLine" ADD CONSTRAINT "TournamentSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "TournamentSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
