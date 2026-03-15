-- 10단계: Feature, PricingPlan, PlanFeature, OrganizationPlanSubscription, OrganizationFeatureAccess, PaymentRecord, ListingProduct, ListingPurchaseRecord

CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Feature_code_key" ON "Feature"("code");

CREATE TABLE "PricingPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planType" TEXT NOT NULL,
    "billingType" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingPlan_code_key" ON "PricingPlan"("code");

CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanFeature_planId_featureId_key" ON "PlanFeature"("planId", "featureId");
CREATE INDEX "PlanFeature_planId_idx" ON "PlanFeature"("planId");
CREATE INDEX "PlanFeature_featureId_idx" ON "PlanFeature"("featureId");

ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PricingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrganizationPlanSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "grantedByUserId" TEXT,
    "sourceType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPlanSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationPlanSubscription_organizationId_idx" ON "OrganizationPlanSubscription"("organizationId");
CREATE INDEX "OrganizationPlanSubscription_planId_idx" ON "OrganizationPlanSubscription"("planId");
CREATE INDEX "OrganizationPlanSubscription_status_expiresAt_idx" ON "OrganizationPlanSubscription"("status", "expiresAt");

ALTER TABLE "OrganizationPlanSubscription" ADD CONSTRAINT "OrganizationPlanSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationPlanSubscription" ADD CONSTRAINT "OrganizationPlanSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PricingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrganizationFeatureAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationFeatureAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationFeatureAccess_organizationId_idx" ON "OrganizationFeatureAccess"("organizationId");
CREATE INDEX "OrganizationFeatureAccess_featureId_idx" ON "OrganizationFeatureAccess"("featureId");
CREATE INDEX "OrganizationFeatureAccess_status_expiresAt_idx" ON "OrganizationFeatureAccess"("status", "expiresAt");

ALTER TABLE "OrganizationFeatureAccess" ADD CONSTRAINT "OrganizationFeatureAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationFeatureAccess" ADD CONSTRAINT "OrganizationFeatureAccess_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "createdByUserId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRecord_organizationId_idx" ON "PaymentRecord"("organizationId");
CREATE INDEX "PaymentRecord_planId_idx" ON "PaymentRecord"("planId");
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PricingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ListingProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "postingMonths" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "appliesToGeneralOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingProduct_code_key" ON "ListingProduct"("code");

CREATE TABLE "ListingPurchaseRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listingProductId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "postingMonths" INTEGER NOT NULL DEFAULT 1,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPurchaseRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingPurchaseRecord_organizationId_idx" ON "ListingPurchaseRecord"("organizationId");
CREATE INDEX "ListingPurchaseRecord_listingProductId_idx" ON "ListingPurchaseRecord"("listingProductId");
CREATE INDEX "ListingPurchaseRecord_status_expiresAt_idx" ON "ListingPurchaseRecord"("status", "expiresAt");

ALTER TABLE "ListingPurchaseRecord" ADD CONSTRAINT "ListingPurchaseRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingPurchaseRecord" ADD CONSTRAINT "ListingPurchaseRecord_listingProductId_fkey" FOREIGN KEY ("listingProductId") REFERENCES "ListingProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
