-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "participantRosterLockedAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "participantRosterSnapshot" TEXT;
