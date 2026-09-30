-- AlterTable
ALTER TABLE "MarketStat" ADD COLUMN     "submittedByAgencyId" TEXT;

-- CreateIndex
CREATE INDEX "MarketStat_submittedByAgencyId_idx" ON "MarketStat"("submittedByAgencyId");
