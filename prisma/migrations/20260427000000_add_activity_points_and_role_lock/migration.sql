-- Add activity point ledger/cache and manual role lock.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activityPoint" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleManualLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UserActivityPoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "description" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityPoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserActivityPoint_idempotencyKey_key"
  ON "UserActivityPoint"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "UserActivityPoint_userId_idx" ON "UserActivityPoint"("userId");
CREATE INDEX IF NOT EXISTS "UserActivityPoint_type_idx" ON "UserActivityPoint"("type");
CREATE INDEX IF NOT EXISTS "UserActivityPoint_createdAt_idx" ON "UserActivityPoint"("createdAt");
CREATE INDEX IF NOT EXISTS "UserActivityPoint_refType_refId_idx" ON "UserActivityPoint"("refType", "refId");

ALTER TABLE "UserActivityPoint" DROP CONSTRAINT IF EXISTS "UserActivityPoint_userId_fkey";
ALTER TABLE "UserActivityPoint"
  ADD CONSTRAINT "UserActivityPoint_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
