-- BilliardNote 테이블이 없을 때만 실행하세요.
-- (이미 다른 마이그레이션으로 DB가 구성된 경우, migrate deploy 대신 이 스크립트만 실행)

CREATE TABLE IF NOT EXISTS "BilliardNote" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "noteDate" TIMESTAMP(3),
    "redBallX" DOUBLE PRECISION NOT NULL,
    "redBallY" DOUBLE PRECISION NOT NULL,
    "yellowBallX" DOUBLE PRECISION NOT NULL,
    "yellowBallY" DOUBLE PRECISION NOT NULL,
    "whiteBallX" DOUBLE PRECISION NOT NULL,
    "whiteBallY" DOUBLE PRECISION NOT NULL,
    "cueBall" TEXT NOT NULL,
    "memo" TEXT,
    "imageUrl" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BilliardNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BilliardNote_authorId_idx" ON "BilliardNote"("authorId");
CREATE INDEX IF NOT EXISTS "BilliardNote_visibility_createdAt_idx" ON "BilliardNote"("visibility", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BilliardNote_authorId_fkey'
  ) THEN
    ALTER TABLE "BilliardNote" ADD CONSTRAINT "BilliardNote_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
