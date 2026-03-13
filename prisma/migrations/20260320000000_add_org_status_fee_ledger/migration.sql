-- AlterTable: Organization 플랫폼 관리(권한 정지/제명, 비고)
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "adminRemarks" TEXT;

-- CreateTable: 클라이언트 회비 설정 (월회비/연회비 택일)
CREATE TABLE IF NOT EXISTS "OrganizationFeeSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "amountInWon" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationFeeSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 클라이언트 회비 입금 장부
CREATE TABLE IF NOT EXISTS "OrganizationFeePayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amountInWon" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationFeePayment_pkey" PRIMARY KEY ("id")
);

-- UniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationFeeSetting_organizationId_key" ON "OrganizationFeeSetting"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationFeePayment_organizationId_idx" ON "OrganizationFeePayment"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationFeePayment_organizationId_period_idx" ON "OrganizationFeePayment"("organizationId", "period");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationFeeSetting_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrganizationFeeSetting" ADD CONSTRAINT "OrganizationFeeSetting_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationFeePayment_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrganizationFeePayment" ADD CONSTRAINT "OrganizationFeePayment_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
