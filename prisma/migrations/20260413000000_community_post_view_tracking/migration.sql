-- 상세 조회 dedup(CommunityPostView) + 조회수(CommunityPost.viewCount)
-- 스키마에만 있고 이전 마이그레이션에 누락된 경우 대비

ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CommunityPostView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "userId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunityPostView_postId_viewerKey_key" ON "CommunityPostView"("postId", "viewerKey");
CREATE INDEX IF NOT EXISTS "CommunityPostView_postId_idx" ON "CommunityPostView"("postId");
CREATE INDEX IF NOT EXISTS "CommunityPostView_viewedAt_idx" ON "CommunityPostView"("viewedAt");

ALTER TABLE "CommunityPostView" DROP CONSTRAINT IF EXISTS "CommunityPostView_postId_fkey";
ALTER TABLE "CommunityPostView" ADD CONSTRAINT "CommunityPostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
