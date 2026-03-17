-- 난구해결사 테이블 수동 생성 (Neon SQL Editor 등에서 실행용)
-- 이미 테이블이 있으면 스킵. 마이그레이션 기록 없이 테이블만 만들 때 사용.

CREATE TABLE IF NOT EXISTS "NanguPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ballPlacementJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NanguPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NanguSolution" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "dataJson" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NanguSolution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NanguPost_authorId_idx" ON "NanguPost"("authorId");
CREATE INDEX IF NOT EXISTS "NanguPost_createdAt_idx" ON "NanguPost"("createdAt");
CREATE INDEX IF NOT EXISTS "NanguSolution_postId_idx" ON "NanguSolution"("postId");
CREATE INDEX IF NOT EXISTS "NanguSolution_authorId_idx" ON "NanguSolution"("authorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NanguPost_authorId_fkey') THEN
    ALTER TABLE "NanguPost" ADD CONSTRAINT "NanguPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NanguSolution_postId_fkey') THEN
    ALTER TABLE "NanguSolution" ADD CONSTRAINT "NanguSolution_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NanguPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NanguSolution_authorId_fkey') THEN
    ALTER TABLE "NanguSolution" ADD CONSTRAINT "NanguSolution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
