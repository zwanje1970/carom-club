-- AlterTable: User communityScore
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "communityScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: CommunityScoreLog
CREATE TABLE IF NOT EXISTS "CommunityScoreLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityScoreLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CommunityScoreLog_userId_idx" ON "CommunityScoreLog"("userId");
CREATE INDEX IF NOT EXISTS "CommunityScoreLog_createdAt_idx" ON "CommunityScoreLog"("createdAt");
ALTER TABLE "CommunityScoreLog" ADD CONSTRAINT "CommunityScoreLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: NanguPost adoptedSolutionId
ALTER TABLE "NanguPost" ADD COLUMN IF NOT EXISTS "adoptedSolutionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "NanguPost_adoptedSolutionId_key" ON "NanguPost"("adoptedSolutionId") WHERE "adoptedSolutionId" IS NOT NULL;

-- AlterTable: NanguSolution goodCount, badCount
ALTER TABLE "NanguSolution" ADD COLUMN IF NOT EXISTS "goodCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NanguSolution" ADD COLUMN IF NOT EXISTS "badCount" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum: NanguSolutionVoteType
DO $$ BEGIN
    CREATE TYPE "NanguSolutionVoteType" AS ENUM ('GOOD', 'BAD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: NanguSolutionVote
CREATE TABLE IF NOT EXISTS "NanguSolutionVote" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "NanguSolutionVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NanguSolutionVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NanguSolutionVote_solutionId_userId_key" ON "NanguSolutionVote"("solutionId", "userId");
CREATE INDEX IF NOT EXISTS "NanguSolutionVote_solutionId_idx" ON "NanguSolutionVote"("solutionId");
CREATE INDEX IF NOT EXISTS "NanguSolutionVote_userId_idx" ON "NanguSolutionVote"("userId");
ALTER TABLE "NanguSolutionVote" ADD CONSTRAINT "NanguSolutionVote_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "NanguSolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NanguSolutionVote" ADD CONSTRAINT "NanguSolutionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: NanguPost.adoptedSolutionId -> NanguSolution.id
ALTER TABLE "NanguPost" DROP CONSTRAINT IF EXISTS "NanguPost_adoptedSolutionId_fkey";
ALTER TABLE "NanguPost" ADD CONSTRAINT "NanguPost_adoptedSolutionId_fkey" FOREIGN KEY ("adoptedSolutionId") REFERENCES "NanguSolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
