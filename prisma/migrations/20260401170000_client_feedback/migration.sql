CREATE TABLE IF NOT EXISTS "ClientFeedback" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "imageUrl" TEXT,
  "pagePath" TEXT,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientFeedback_userId_idx" ON "ClientFeedback"("userId");
CREATE INDEX IF NOT EXISTS "ClientFeedback_createdAt_idx" ON "ClientFeedback"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ClientFeedback_userId_fkey'
  ) THEN
    ALTER TABLE "ClientFeedback"
      ADD CONSTRAINT "ClientFeedback_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
