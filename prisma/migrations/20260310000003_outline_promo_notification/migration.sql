-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "promoDraft" TEXT;
ALTER TABLE "Organization" ADD COLUMN "promoPublished" TEXT;
ALTER TABLE "Organization" ADD COLUMN "promoPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "outlineDraft" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "outlinePublished" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "outlinePublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TournamentEntry" ADD COLUMN "waitingListOrder" INTEGER;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
