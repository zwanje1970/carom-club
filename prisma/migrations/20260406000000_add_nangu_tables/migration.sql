-- CreateTable
CREATE TABLE "NanguPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ballPlacementJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NanguPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NanguSolution" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "dataJson" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NanguSolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NanguPost_authorId_idx" ON "NanguPost"("authorId");

-- CreateIndex
CREATE INDEX "NanguPost_createdAt_idx" ON "NanguPost"("createdAt");

-- CreateIndex
CREATE INDEX "NanguSolution_postId_idx" ON "NanguSolution"("postId");

-- CreateIndex
CREATE INDEX "NanguSolution_authorId_idx" ON "NanguSolution"("authorId");

-- AddForeignKey
ALTER TABLE "NanguPost" ADD CONSTRAINT "NanguPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NanguSolution" ADD CONSTRAINT "NanguSolution_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NanguPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NanguSolution" ADD CONSTRAINT "NanguSolution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
