-- 제목 ILIKE contains(%) 성능: pg_trgm GIN
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "CommunityPost_title_gin_trgm_idx" ON "CommunityPost" USING gin ("title" gin_trgm_ops);

-- Prisma @@index([boardId, isHidden, title]) — 마이그레이션에 명시 (스키마와 동기화)
CREATE INDEX IF NOT EXISTS "CommunityPost_boardId_isHidden_title_idx" ON "CommunityPost" ("boardId", "isHidden", "title");
