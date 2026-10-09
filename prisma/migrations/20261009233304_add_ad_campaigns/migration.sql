-- CreateEnum
CREATE TYPE "AdSlotKey" AS ENUM ('HOME_BAND', 'MARKET_SIDEBAR', 'PROPERTY_BELOW_FINANCIALS', 'NEIGHBORHOOD_SPONSOR');

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "advertiser" TEXT NOT NULL,
    "slot" "AdSlotKey" NOT NULL,
    "neighborhoodId" TEXT,
    "linkUrl" TEXT NOT NULL,
    "altEn" TEXT NOT NULL,
    "altAr" TEXT,
    "imageEnPath" TEXT NOT NULL,
    "imageArPath" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "agreedPrice" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdDailyStat" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdCampaign_slot_isActive_startsAt_endsAt_idx" ON "AdCampaign"("slot", "isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AdCampaign_neighborhoodId_idx" ON "AdCampaign"("neighborhoodId");

-- CreateIndex
CREATE UNIQUE INDEX "AdDailyStat_campaignId_day_key" ON "AdDailyStat"("campaignId", "day");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
