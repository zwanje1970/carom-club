ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "tvAccessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "tvAccessTokenIssuedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_tvAccessToken_key"
  ON "Tournament"("tvAccessToken");

CREATE INDEX IF NOT EXISTS "Tournament_tvAccessToken_idx"
  ON "Tournament"("tvAccessToken");
