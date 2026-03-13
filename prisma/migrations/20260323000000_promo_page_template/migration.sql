-- CreateTable: 홍보 페이지 템플릿
CREATE TABLE "PromoPageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "contentHtml" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoPageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromoPageTemplate_isDefault_idx" ON "PromoPageTemplate"("isDefault");
CREATE INDEX "PromoPageTemplate_category_idx" ON "PromoPageTemplate"("category");
