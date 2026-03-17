-- CommunityBoard: type, isActive
ALTER TABLE "CommunityBoard" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "CommunityBoard" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "CommunityBoard_type_isActive_idx" ON "CommunityBoard"("type", "isActive");

-- CommunityPost: thumbnailUrl, likeCount, commentCount, isSolved
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "commentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "isSolved" BOOLEAN NOT NULL DEFAULT false;

-- TroubleShotPost
CREATE TABLE IF NOT EXISTS "TroubleShotPost" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "sourceNoteId" TEXT,
  "layoutImageUrl" TEXT,
  "difficulty" TEXT,
  "isSolved" BOOLEAN NOT NULL DEFAULT false,
  "acceptedSolutionId" TEXT,

  CONSTRAINT "TroubleShotPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TroubleShotPost_postId_key" ON "TroubleShotPost"("postId");
CREATE INDEX IF NOT EXISTS "TroubleShotPost_postId_idx" ON "TroubleShotPost"("postId");
CREATE INDEX IF NOT EXISTS "TroubleShotPost_sourceNoteId_idx" ON "TroubleShotPost"("sourceNoteId");
CREATE INDEX IF NOT EXISTS "TroubleShotPost_isSolved_idx" ON "TroubleShotPost"("isSolved");
ALTER TABLE "TroubleShotPost" ADD CONSTRAINT "TroubleShotPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TroubleShotPost" ADD CONSTRAINT "TroubleShotPost_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "BilliardNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TroubleShotSolution
CREATE TABLE IF NOT EXISTS "TroubleShotSolution" (
  "id" TEXT NOT NULL,
  "troubleShotPostId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "solutionImageUrl" TEXT,
  "voteCount" INTEGER NOT NULL DEFAULT 0,
  "isAccepted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TroubleShotSolution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TroubleShotSolution_troubleShotPostId_idx" ON "TroubleShotSolution"("troubleShotPostId");
CREATE INDEX IF NOT EXISTS "TroubleShotSolution_authorId_idx" ON "TroubleShotSolution"("authorId");
ALTER TABLE "TroubleShotSolution" ADD CONSTRAINT "TroubleShotSolution_troubleShotPostId_fkey" FOREIGN KEY ("troubleShotPostId") REFERENCES "TroubleShotPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TroubleShotSolution" ADD CONSTRAINT "TroubleShotSolution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
