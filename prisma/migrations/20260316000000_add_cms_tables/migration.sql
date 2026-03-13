-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "page" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageUrlMobile" TEXT,
    "imageHeightPc" INTEGER,
    "imageHeightMobile" INTEGER,
    "linkType" TEXT NOT NULL DEFAULT 'none',
    "internalPage" TEXT,
    "internalPath" TEXT,
    "externalUrl" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "buttons" JSONB,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Popup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "buttonName" TEXT,
    "buttonLink" TEXT,
    "page" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "hideForTodayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showCloseButton" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Popup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeBar" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'none',
    "internalPath" TEXT,
    "externalUrl" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "backgroundColor" TEXT NOT NULL DEFAULT '#1e3a5f',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "page" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'below_header',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeBar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageSection_page_placement_idx" ON "PageSection"("page", "placement");

-- CreateIndex
CREATE INDEX "PageSection_page_idx" ON "PageSection"("page");

-- CreateIndex
CREATE INDEX "Popup_page_idx" ON "Popup"("page");

-- CreateIndex
CREATE INDEX "NoticeBar_page_idx" ON "NoticeBar"("page");
