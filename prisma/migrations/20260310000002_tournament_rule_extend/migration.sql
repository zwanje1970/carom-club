-- AlterTable
ALTER TABLE "TournamentRule" ADD COLUMN "useWaiting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TournamentRule" ADD COLUMN "bracketConfig" JSONB;
ALTER TABLE "TournamentRule" ADD COLUMN "prizeType" TEXT;
