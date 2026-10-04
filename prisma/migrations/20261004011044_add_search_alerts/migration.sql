-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "lastAlertedAt" TIMESTAMP(3),
ADD COLUMN     "lastMatchedListingId" TEXT;

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "matchedCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertLog_savedSearchId_createdAt_idx" ON "AlertLog"("savedSearchId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertLog_userId_createdAt_idx" ON "AlertLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
