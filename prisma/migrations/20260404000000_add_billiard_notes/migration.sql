-- CreateTable
CREATE TABLE "BilliardNote" (
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

-- CreateIndex
CREATE INDEX "BilliardNote_authorId_idx" ON "BilliardNote"("authorId");

-- CreateIndex
CREATE INDEX "BilliardNote_visibility_createdAt_idx" ON "BilliardNote"("visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "BilliardNote" ADD CONSTRAINT "BilliardNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
