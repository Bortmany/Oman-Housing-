// The averages-from-live-listings job against a real (test) database.
// Run with: npm test  (scripts/with-test-db.mjs points DATABASE_URL at the
// test database). It refuses to run against any database whose name does not
// end in "_test", and cleans up every row it makes.
//
// Proves: only ACTIVE, non-sample listings count; an average is saved as
// LISTING_DERIVED with the true count; it replaces a sample figure and an
// earlier average but NEVER an official, verified or user-submitted one; an
// average whose place falls below 5 listings is removed; older months and
// non-derived rows are never touched.
import { prisma } from "./prisma";
import { runListingAveragesJob, currentMonthStartUtc } from "./listingAveragesJob";

const dbName = new URL(process.env.DATABASE_URL ?? "postgresql://x/none").pathname;
if (!dbName.endsWith("_test")) {
  console.error(`Refusing to run: DATABASE_URL (${dbName}) is not a test database. Use npm test.`);
  process.exit(1);
}

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const TAG = `lavg-${Date.now()}`;
const now = new Date();
const month = currentMonthStartUtc(now);
const lastMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));

async function main() {
  const gov = await prisma.governorate.create({ data: { slug: `${TAG}-g`, nameEn: "G", nameAr: "G" } });
  const city = await prisma.city.create({ data: { slug: `${TAG}-c`, nameEn: "C", nameAr: "C", governorateId: gov.id } });
  const hood = await prisma.neighborhood.create({ data: { slug: `${TAG}-n`, nameEn: "N", nameAr: "N", cityId: city.id } });
  const user = await prisma.user.create({ data: { email: `${TAG}@example.test`, role: "ADMIN" } });

  const makeListings = async (
    count: number,
    type: "APARTMENT" | "VILLA",
    o: { price: number; isSample?: boolean; status?: "ACTIVE" | "DRAFT"; listingType?: "SALE" | "RENT"; rentPeriod?: "MONTHLY" | "ANNUAL" | null },
  ) => {
    for (let i = 0; i < count; i++) {
      const property = await prisma.property.create({
        data: {
          neighborhoodId: hood.id, type, titleEn: `${TAG} home`, areaSqm: 100,
          isSample: o.isSample ?? false,
        },
      });
      await prisma.listing.create({
        data: {
          propertyId: property.id, listingType: o.listingType ?? "SALE", price: o.price,
          rentPeriod: o.rentPeriod ?? null, status: o.status ?? "ACTIVE",
          createdById: user.id, isSample: o.isSample ?? false,
        },
      });
    }
  };

  const statWhere = { OR: [{ governorateId: gov.id }, { cityId: city.id }, { neighborhoodId: hood.id }] };
  const derived = () =>
    prisma.marketStat.findMany({ where: { ...statWhere, provenance: "LISTING_DERIVED" }, orderBy: [{ propertyType: "asc" }] });

  try {
    // 6 real apartment sales, 6 sample ones, 3 drafts: only the 6 count.
    await makeListings(6, "APARTMENT", { price: 100_000 });
    await makeListings(6, "APARTMENT", { price: 1, isSample: true });
    await makeListings(3, "APARTMENT", { price: 999_999, status: "DRAFT" });
    // 5 real villa sales, but an official figure already exists for them.
    await makeListings(5, "VILLA", { price: 300_000 });

    const base = { neighborhoodId: hood.id, periodStart: month, confidence: 0.9, sourceNote: "test" };
    await prisma.marketStat.create({ data: { ...base, propertyType: "VILLA", avgSalePrice: 777_000, provenance: "OFFICIAL_STAT" } });
    // A sample (invented) apartment figure for the same place/type/month: replaced.
    await prisma.marketStat.create({ data: { ...base, propertyType: "APARTMENT", avgSalePrice: 1, provenance: "AI_ESTIMATED", isSample: true } });
    // An older-month derived row and a user-submitted row: never touched.
    await prisma.marketStat.create({ data: { ...base, periodStart: lastMonth, propertyType: "APARTMENT", avgSalePrice: 5, provenance: "LISTING_DERIVED" } });
    await prisma.marketStat.create({ data: { ...base, propertyType: "OFFICE", avgSalePrice: 5, provenance: "USER_SUBMITTED" } });
    // A stale derived row this month (no listings behind it): deleted.
    await prisma.marketStat.create({ data: { ...base, propertyType: "LAND", avgSalePrice: 5, provenance: "LISTING_DERIVED" } });

    const first = await runListingAveragesJob(now);
    // Apartment: neighbourhood + city + governorate = 3 written. Villa: 3 skipped
    // (neighbourhood row is official; city + governorate rows are new => written).
    expectEqual("first run: written", first.written, 5);
    expectEqual("first run: skipped because an official figure exists", first.skippedOfficial, 1);
    expectEqual("first run: stale average removed", first.deleted, 1);

    const hoodApt = await prisma.marketStat.findFirst({ where: { neighborhoodId: hood.id, propertyType: "APARTMENT", periodStart: month } });
    expectEqual("sample figure replaced in place by the real average", [hoodApt?.provenance, hoodApt?.isSample], ["LISTING_DERIVED", false]);
    expectEqual("average is the true mean of the 6 real listings", Number(hoodApt?.avgSalePrice), 100_000);
    expectEqual("sample size is the true count (samples and drafts ignored)", hoodApt?.sampleSize, 6);
    expectEqual("confidence 0.32 at 6 listings", hoodApt?.confidence, 0.32);
    expectEqual("source note says asking prices", /Asking prices, not sale prices/.test(hoodApt?.sourceNote ?? ""), true);
    expectEqual("price per sqm from the 6 areas", Number(hoodApt?.avgPricePerSqm), 1000);

    const official = await prisma.marketStat.findFirst({ where: { neighborhoodId: hood.id, propertyType: "VILLA", periodStart: month } });
    expectEqual("official figure untouched", [official?.provenance, Number(official?.avgSalePrice)], ["OFFICIAL_STAT", 777_000]);
    const user1 = await prisma.marketStat.findFirst({ where: { neighborhoodId: hood.id, propertyType: "OFFICE" } });
    expectEqual("user-submitted figure untouched", user1?.provenance, "USER_SUBMITTED");
    const old = await prisma.marketStat.findFirst({ where: { neighborhoodId: hood.id, periodStart: lastMonth } });
    expectEqual("older month kept as history", Number(old?.avgSalePrice), 5);
    const land = await prisma.marketStat.findFirst({ where: { neighborhoodId: hood.id, propertyType: "LAND" } });
    expectEqual("stale derived row gone", land, null);

    const second = await runListingAveragesJob(now);
    expectEqual("second run: same figures, nothing doubled", [second.written, second.skippedOfficial, second.deleted], [5, 1, 0]);
    expectEqual("no duplicate rows", (await derived()).filter((r) => r.periodStart.getTime() === month.getTime()).length, 5);

    // Drop the apartments below 5 and recompute: their averages disappear.
    const toDelete = await prisma.listing.findMany({ where: { createdById: user.id, isSample: false, status: "ACTIVE", property: { type: "APARTMENT" } }, take: 2, select: { id: true } });
    await prisma.listing.deleteMany({ where: { id: { in: toDelete.map((l) => l.id) } } });
    const third = await runListingAveragesJob(now);
    expectEqual("below 5: apartment averages removed (3 places)", third.deleted, 3);
    const left = (await derived()).filter((r) => r.periodStart.getTime() === month.getTime());
    expectEqual("only the villa city + governorate averages remain", left.map((r) => r.propertyType), ["VILLA", "VILLA"]);
  } finally {
    await prisma.marketStat.deleteMany({ where: statWhere });
    await prisma.listing.deleteMany({ where: { createdById: user.id } });
    await prisma.property.deleteMany({ where: { neighborhoodId: hood.id } });
    await prisma.neighborhood.delete({ where: { id: hood.id } });
    await prisma.city.delete({ where: { id: city.id } });
    await prisma.governorate.delete({ where: { id: gov.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failures > 0) {
      console.error(`\n${failures} listing-averages job check(s) failed`);
      process.exit(1);
    }
    console.log("\nAll listing-averages job checks passed.");
  });
