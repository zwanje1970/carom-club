-- AlterTable: TroubleShotSolution goodCount, badCount
ALTER TABLE "TroubleShotSolution" ADD COLUMN IF NOT EXISTS "goodCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TroubleShotSolution" ADD COLUMN IF NOT EXISTS "badCount" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum: TroubleShotSolutionVoteType
DO $$ BEGIN
  CREATE TYPE "TroubleShotSolutionVoteType" AS ENUM ('GOOD', 'BAD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: TroubleShotSolutionVote
CREATE TABLE IF NOT EXISTS "TroubleShotSolutionVote" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "TroubleShotSolutionVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TroubleShotSolutionVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TroubleShotSolutionVote_solutionId_userId_key" ON "TroubleShotSolutionVote"("solutionId", "userId");
CREATE INDEX IF NOT EXISTS "TroubleShotSolutionVote_solutionId_idx" ON "TroubleShotSolutionVote"("solutionId");
CREATE INDEX IF NOT EXISTS "TroubleShotSolutionVote_userId_idx" ON "TroubleShotSolutionVote"("userId");

ALTER TABLE "TroubleShotSolutionVote" ADD CONSTRAINT "TroubleShotSolutionVote_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "TroubleShotSolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TroubleShotSolutionVote" ADD CONSTRAINT "TroubleShotSolutionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
