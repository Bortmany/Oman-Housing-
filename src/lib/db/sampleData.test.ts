// Sample-data rule tests. Run with: npm test
//
// Proves the honesty rule for invented demonstration data: a sample figure
// steps aside only for a real figure with the same place, type and month;
// other months and types stay; a real valuation beats a sample one; a real
// live listing hides sample homes of the same area and type; the home page's
// sample-only mode switches off once any real figure exists; and a figure
// written through the app is never sample and never keeps invented metrics.
import {
  anySample,
  dropSupersededSampleStats,
  hideSupersededSampleListings,
  hideSupersededSampleProperties,
  isSampleListing,
  isSampleOnlySite,
  isSampleValuation,
  latestVisibleStat,
  latestVisibleStatPerNeighborhood,
  preferRealValuation,
  realActiveListingKeys,
} from "./sampleData";
import { buildMarketStatWriteData } from "./marketStatData";

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

const month = (m: number) => new Date(Date.UTC(2026, m, 1));
type Stat = {
  id: string;
  neighborhoodId: string | null;
  propertyType: "APARTMENT" | "VILLA";
  periodStart: Date | string;
  isSample: boolean;
};
const stat = (
  id: string,
  hood: string,
  type: Stat["propertyType"],
  m: number,
  isSample: boolean,
): Stat => ({ id, neighborhoodId: hood, propertyType: type, periodStart: month(m), isSample });

// --- Market figures: the narrow rule (same place + type + month) ---
{
  const rows = [
    stat("s-jun-apt", "al-mouj", "APARTMENT", 5, true),
    stat("s-may-apt", "al-mouj", "APARTMENT", 4, true),
    stat("s-jun-villa", "al-mouj", "VILLA", 5, true),
    stat("s-jun-qurum", "qurum", "APARTMENT", 5, true),
    stat("r-jun-apt", "al-mouj", "APARTMENT", 5, false),
  ];
  const ids = dropSupersededSampleStats(rows).map((r) => r.id);
  expectEqual("sample row with a real twin is dropped", ids.includes("s-jun-apt"), false);
  expectEqual("the real row stays", ids.includes("r-jun-apt"), true);
  expectEqual("same place+type, other month stays sample", ids.includes("s-may-apt"), true);
  expectEqual("same place+month, other type stays sample", ids.includes("s-jun-villa"), true);
  expectEqual("other place, same type+month stays sample", ids.includes("s-jun-qurum"), true);
}

{
  // Cached rows carry ISO strings, not Dates — the key must match either way.
  const rows = [
    { ...stat("s", "al-mouj", "APARTMENT", 5, true), periodStart: month(5).toISOString() },
    stat("r", "al-mouj", "APARTMENT", 5, false),
  ];
  expectEqual("string and Date months match", dropSupersededSampleStats(rows).map((r) => r.id), ["r"]);
}

{
  // A city-level figure never hides a neighbourhood figure (different place).
  const rows = [
    { ...stat("s-hood", "al-mouj", "APARTMENT", 5, true), cityId: null },
    { ...stat("r-city", "", "APARTMENT", 5, false), neighborhoodId: null, cityId: "seeb" },
  ];
  expectEqual("different scope never supersedes", dropSupersededSampleStats(rows).length, 2);
}

expectEqual(
  "all-sample history is untouched",
  dropSupersededSampleStats([stat("a", "x", "VILLA", 1, true), stat("b", "x", "VILLA", 2, true)]).length,
  2,
);

{
  const rows = [
    stat("s-jun", "al-mouj", "APARTMENT", 5, true),
    stat("r-jun", "al-mouj", "APARTMENT", 5, false),
    stat("s-may", "al-mouj", "APARTMENT", 4, true),
  ];
  expectEqual("latest after hiding is the real row", latestVisibleStat(rows)?.id, "r-jun");
  expectEqual(
    "latest with only an older real month stays the newer sample",
    latestVisibleStat([stat("s-jun", "h", "APARTMENT", 5, true), stat("r-mar", "h", "APARTMENT", 2, false)])?.id,
    "s-jun",
  );
  expectEqual("no rows → no latest", latestVisibleStat([]), null);
}

{
  const rows = [
    stat("mouj-s-jun", "al-mouj", "APARTMENT", 5, true),
    stat("mouj-r-jun", "al-mouj", "APARTMENT", 5, false),
    stat("mouj-s-may", "al-mouj", "APARTMENT", 4, true),
    stat("qurum-s-jun", "qurum", "APARTMENT", 5, true),
    stat("qurum-s-may", "qurum", "APARTMENT", 4, true),
  ];
  expectEqual(
    "latest per neighbourhood applies the rule",
    latestVisibleStatPerNeighborhood(rows).map((r) => r.id),
    ["mouj-r-jun", "qurum-s-jun"],
  );
}

// --- Derived figures ---
expectEqual("any sample input makes the result sample", anySample([{ isSample: false }, { isSample: true }]), true);
expectEqual("all real inputs keep it real", anySample([{ isSample: false }, null]), false);

// --- Valuations: real beats sample ---
{
  const newestSample = { id: "sample-new", isSample: true };
  const olderReal = { id: "real-old", isSample: false };
  expectEqual("real valuation beats a newer sample one", preferRealValuation([newestSample, olderReal])?.id, "real-old");
  expectEqual("sample valuation used when no real one exists", preferRealValuation([newestSample])?.id, "sample-new");
  expectEqual("newest real wins among real ones", preferRealValuation([{ id: "r1", isSample: false }, { id: "r2", isSample: false }])?.id, "r1");
  expectEqual("no valuations → none", preferRealValuation([]), null);
  expectEqual("a real valuation of a sample home is sample", isSampleValuation({ isSample: false }, { isSample: true }), true);
  expectEqual("a sample valuation of a real home is sample", isSampleValuation({ isSample: true }, { isSample: false }), true);
  expectEqual("a real valuation of a real home is real", isSampleValuation({ isSample: false }, { isSample: false }), false);
}

// --- Listings & properties ---
{
  const prop = (hood: string, type: "APARTMENT" | "VILLA", isSample: boolean) => ({
    isSample, neighborhoodId: hood, type,
  });
  const listing = (id: string, status: string, isSample: boolean, p: ReturnType<typeof prop>) => ({
    id, status, isSample, property: p,
  });

  const sampleMoujApt = listing("s-apt", "ACTIVE", true, prop("al-mouj", "APARTMENT", true));
  const sampleMoujVilla = listing("s-villa", "ACTIVE", true, prop("al-mouj", "VILLA", true));
  const sampleQurumApt = listing("s-qurum", "ACTIVE", true, prop("qurum", "APARTMENT", true));
  const realPending = listing("r-pending", "PENDING_REVIEW", false, prop("al-mouj", "APARTMENT", false));

  expectEqual(
    "no real live listing → nothing hidden",
    hideSupersededSampleListings([sampleMoujApt, sampleMoujVilla], realActiveListingKeys([realPending])).length,
    2,
  );

  const realLive = listing("r-live", "ACTIVE", false, prop("al-mouj", "APARTMENT", false));
  const keys = realActiveListingKeys([realLive, realPending, sampleQurumApt]);
  const visible = hideSupersededSampleListings([sampleMoujApt, sampleMoujVilla, sampleQurumApt, realLive], keys).map((l) => l.id);
  expectEqual("sample listing of same area+type is hidden", visible.includes("s-apt"), false);
  expectEqual("sample listing of other type stays", visible.includes("s-villa"), true);
  expectEqual("sample listing of other area stays", visible.includes("s-qurum"), true);
  expectEqual("the real listing stays", visible.includes("r-live"), true);

  const onSampleHome = listing("x", "ACTIVE", false, prop("al-mouj", "APARTMENT", true));
  expectEqual("a listing on a sample home is sample", isSampleListing(onSampleHome), true);
  expectEqual("a real listing on a sample home does not count as real", realActiveListingKeys([onSampleHome]).size, 0);

  const props = [
    { id: "p-apt", ...prop("al-mouj", "APARTMENT", true) },
    { id: "p-villa", ...prop("al-mouj", "VILLA", true) },
    { id: "p-real", ...prop("al-mouj", "APARTMENT", false) },
  ];
  expectEqual(
    "sample property of same area+type is hidden, others stay",
    hideSupersededSampleProperties(props, keys).map((p) => p.id),
    ["p-villa", "p-real"],
  );
}

// --- Home page sample-only mode ---
expectEqual("no real market figure → sample-only mode on", isSampleOnlySite(0), true);
expectEqual("one real market figure → sample-only mode off", isSampleOnlySite(1), false);

// --- App writes are never sample ---
{
  const data = buildMarketStatWriteData({
    metrics: { avgSalePrice: 118_000, avgRentMonthly: 640 },
    provenance: "OFFICIAL_STAT",
    confidence: 0.8,
    sourceNote: "NCSI bulletin",
    sourceUrl: "https://example.org",
  });
  expectEqual("app write sets isSample false", data.isSample, false);
  expectEqual("supplied metric kept", data.avgSalePrice, 118_000);
  expectEqual("unsupplied sample size cleared", data.sampleSize, null);
  expectEqual("unsupplied median cleared", data.medianSalePrice, null);
  expectEqual("unsupplied yield cleared", data.grossYieldPct, null);
  expectEqual("unsupplied transaction count cleared", data.transactionCount, null);
  expectEqual("unsupplied price per sqm cleared", data.avgPricePerSqm, null);

  const now = new Date(Date.UTC(2026, 8, 30));
  const verified = buildMarketStatWriteData(
    { metrics: {}, provenance: "VERIFIED", confidence: 0.9, verifiedById: "admin1" },
    now,
  );
  expectEqual("verified write records who and when", [verified.verifiedById, verified.verifiedAt], ["admin1", now]);
  expectEqual("verified write is not sample either", verified.isSample, false);
  expectEqual("non-verified write clears stale verified stamp", [data.verifiedById, data.verifiedAt], [null, null]);
}

if (failures > 0) {
  console.error(`\n${failures} sample-data test(s) failed`);
  process.exit(1);
}
console.log("\nAll sample-data tests passed.");
