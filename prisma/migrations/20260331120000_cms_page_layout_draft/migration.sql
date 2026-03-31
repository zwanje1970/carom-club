-- CreateTable
CREATE TABLE "CmsPageLayoutDraft" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsPageLayoutDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsPageLayoutDraft_page_key" ON "CmsPageLayoutDraft"("page");

-- CreateIndex
CREATE INDEX "CmsPageLayoutDraft_page_idx" ON "CmsPageLayoutDraft"("page");
