-- AlterTable
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
