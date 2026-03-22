-- 목록/인기 정렬용 복합 인덱스 (CommunityPost)
CREATE INDEX IF NOT EXISTS "CommunityPost_boardId_isHidden_createdAt_idx" ON "CommunityPost"("boardId", "isHidden", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityPost_boardId_isHidden_viewCount_idx" ON "CommunityPost"("boardId", "isHidden", "viewCount");
CREATE INDEX IF NOT EXISTS "CommunityPost_boardId_isHidden_likeCount_idx" ON "CommunityPost"("boardId", "isHidden", "likeCount");
CREATE INDEX IF NOT EXISTS "CommunityPost_boardId_isHidden_commentCount_idx" ON "CommunityPost"("boardId", "isHidden", "commentCount");
CREATE INDEX IF NOT EXISTS "CommunityPost_boardId_isHidden_isSolved_createdAt_idx" ON "CommunityPost"("boardId", "isHidden", "isSolved", "createdAt");

-- 캐시 컬럼을 실제 건수와 맞춤 (기존 데이터)
UPDATE "CommunityPost" SET "commentCount" = (
  SELECT COUNT(*) FROM "CommunityComment" c WHERE c."postId" = "CommunityPost"."id"
);
UPDATE "CommunityPost" SET "likeCount" = (
  SELECT COUNT(*) FROM "CommunityPostLike" l WHERE l."postId" = "CommunityPost"."id"
);
