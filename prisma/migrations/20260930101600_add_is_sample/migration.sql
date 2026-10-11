-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MarketStat" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ValuationEstimate" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Mark rows that the seed already wrote as sample data, so a database seeded
-- before this change never shows invented figures as real. Matching is on the
-- exact text, source and confidence the seed writes (prisma/seed.ts), and
-- never on a verified row; a row an admin has since edited or verified no
-- longer matches and stays real. Safe to re-run (only ever sets the flag to
-- true). "confidence" is a double, so it is compared with a tiny tolerance.
-- ---------------------------------------------------------------------------

UPDATE "MarketStat" SET "isSample" = true
WHERE "sourceNote" = 'Sample data for demonstration — replace with real figures.'
  AND "verifiedAt" IS NULL
  AND (
    ("provenance" = 'AI_ESTIMATED' AND abs("confidence" - 0.35) < 1e-9)
    OR ("provenance" = 'USER_SUBMITTED' AND abs("confidence" - 0.4) < 1e-9)
  );

UPDATE "Property" SET "isSample" = true
WHERE "sourceNote" = 'Sample record for demonstration.'
  AND "verifiedAt" IS NULL;

UPDATE "ValuationEstimate" SET "isSample" = true
WHERE "assumptions" LIKE 'Sample AI-estimated valuation for demonstration%';

-- A listing on an invented home is invented (Listing has no source note).
UPDATE "Listing" SET "isSample" = true
WHERE "propertyId" IN (SELECT "id" FROM "Property" WHERE "isSample" = true);
