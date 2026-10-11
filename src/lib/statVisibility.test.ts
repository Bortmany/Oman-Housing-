// Public-visibility rule tests. Run with: npm test
//
// Proves the honesty rule for submitted figures: an agency/user figure the
// owner has not approved is never public (nor offered to the AI analyst); an
// approved one is; official, verified, estimated and listing-derived figures
// are; Step 1's sample rule still applies on top, and an unapproved figure can
// never hide a sample one. Also checks, by reading the source, that every
// public market-figure query goes through publicStatWhere, and the
// upsertMarketStat conflict setting (a skip never overwrites; the averages job
// never overwrites a real official, verified or submitted figure).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_STAT_WHERE,
  isPubliclyVisibleStat,
  publicStatWhere,
  publicStats,
} from "./statVisibility";
import { mayReplaceExistingStat } from "./db/marketStatData";

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

type Row = {
  id: string;
  provenance: string;
  verifiedAt: Date | null;
  isSample: boolean;
  neighborhoodId: string | null;
  propertyType: "APARTMENT" | "VILLA" | null;
  periodStart: Date;
};

const april = new Date(Date.UTC(2026, 3, 1));
const may = new Date(Date.UTC(2026, 4, 1));
const stat = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  provenance: "OFFICIAL_STAT",
  verifiedAt: null,
  isSample: false,
  neighborhoodId: "qurum",
  propertyType: "APARTMENT",
  periodStart: april,
  ...over,
});

// ---------- The where fragment (what the database is asked) ----------

expectEqual(
  "where fragment: NOT (USER_SUBMITTED AND verifiedAt IS NULL)",
  PUBLIC_STAT_WHERE,
  { NOT: { provenance: "USER_SUBMITTED", verifiedAt: null } },
);
expectEqual(
  "publicStatWhere keeps the reader's own filter and adds the rule",
  publicStatWhere({ neighborhoodId: "qurum" }),
  { AND: [{ neighborhoodId: "qurum" }, PUBLIC_STAT_WHERE] },
);

/** How Postgres evaluates the fragment for one row. */
function fragmentMatches(row: Row): boolean {
  const n = PUBLIC_STAT_WHERE.NOT;
  const inner = row.provenance === n.provenance && row.verifiedAt === n.verifiedAt;
  return !inner;
}

const matrix: Array<[string, Row, boolean]> = [
  ["unapproved user-submitted", stat("a", { provenance: "USER_SUBMITTED" }), false],
  ["approved user-submitted", stat("b", { provenance: "USER_SUBMITTED", verifiedAt: may }), true],
  ["official", stat("c"), true],
  ["verified", stat("d", { provenance: "VERIFIED", verifiedAt: may }), true],
  ["AI estimated", stat("e", { provenance: "AI_ESTIMATED" }), true],
  ["from live listings", stat("f", { provenance: "LISTING_DERIVED" }), true],
];
for (const [label, row, visible] of matrix) {
  expectEqual(`${label}: ${visible ? "shown" : "hidden"} (query)`, fragmentMatches(row), visible);
  expectEqual(`${label}: ${visible ? "shown" : "hidden"} (in memory)`, isPubliclyVisibleStat(row), visible);
}

// ---------- Composed with Step 1's sample rule ----------

const sampleApril = stat("sample", { isSample: true, provenance: "OFFICIAL_STAT" });
expectEqual(
  "unapproved submission is hidden AND does not hide the sample figure",
  publicStats([stat("sub", { provenance: "USER_SUBMITTED" }), sampleApril]).map((r) => r.id),
  ["sample"],
);
expectEqual(
  "approved submission replaces the sample figure publicly",
  publicStats([stat("sub", { provenance: "USER_SUBMITTED", verifiedAt: may }), sampleApril]).map((r) => r.id),
  ["sub"],
);
expectEqual(
  "official figure hides the sample one (Step 1 rule unchanged)",
  publicStats([stat("off"), sampleApril]).map((r) => r.id),
  ["off"],
);
expectEqual(
  "other months untouched",
  publicStats([stat("off", { periodStart: may }), sampleApril]).map((r) => r.id),
  ["off", "sample"],
);

// ---------- Every public reader uses the rule (source check) ----------

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

/** Each marketStat.findMany/count call in the file, with its argument text. */
function statQueries(source: string): string[] {
  const out: string[] = [];
  const re = /marketStat\.(findMany|count)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(source.slice(m.index, m.index + 160));
  return out;
}

const READERS: Array<[string, number, string]> = [
  // file, minimum number of public stat queries, what they are
  ["lib/db/market-stats.ts", 5, "latestStatsByNeighborhood, latestNeighborhoodStat, neighborhoodTrends, latestAreaFiguresFor, siteHasOnlySampleData"],
  ["lib/db/listings.ts", 1, "nearestMarketStat"],
  ["lib/ai/analyst.ts", 1, "the AI analyst's figure history"],
];
for (const [file, min, what] of READERS) {
  const queries = statQueries(read(file));
  expectEqual(`${file}: found its public stat queries (${what})`, queries.length >= min, true);
  const unfiltered = queries.filter((q) => !/where:\s*publicStatWhere\(/.test(q));
  expectEqual(`${file}: every stat query uses publicStatWhere`, unfiltered, []);
}
expectEqual(
  "the AI analyst's nearest figure comes from nearestMarketStat (same rule)",
  /nearestMarketStat\(property\.neighborhoodId/.test(read("lib/ai/analyst.ts")),
  true,
);

// Admin screens must keep seeing every row.
for (const file of [
  "app/[locale]/(admin)/admin/market-stats/page.tsx",
  "app/[locale]/(admin)/admin/review/page.tsx",
  "app/[locale]/(admin)/admin/page.tsx",
]) {
  expectEqual(`${file}: admin sees everything (no public filter)`, /publicStatWhere|statVisibility/.test(read(file)), false);
}

// ---------- upsertMarketStat conflict setting ----------

const existing = (provenance: string, isSample = false) => ({ provenance, isSample });
expectEqual("replace (default): overwrites anything", mayReplaceExistingStat("replace", existing("VERIFIED")), true);
expectEqual(
  "skip: never overwrites, not even a sample",
  ["OFFICIAL_STAT", "VERIFIED", "USER_SUBMITTED", "LISTING_DERIVED"].map((p) =>
    mayReplaceExistingStat("skip", existing(p)),
  ).concat(mayReplaceExistingStat("skip", existing("OFFICIAL_STAT", true))),
  [false, false, false, false, false],
);
expectEqual(
  "replace-derived-only: never overwrites official, verified, submitted or estimated",
  ["OFFICIAL_STAT", "VERIFIED", "USER_SUBMITTED", "AI_ESTIMATED"].map((p) =>
    mayReplaceExistingStat("replace-derived-only", existing(p)),
  ),
  [false, false, false, false],
);
expectEqual(
  "replace-derived-only: overwrites an older average",
  mayReplaceExistingStat("replace-derived-only", existing("LISTING_DERIVED")),
  true,
);
expectEqual(
  "replace-derived-only: overwrites an invented sample figure",
  mayReplaceExistingStat("replace-derived-only", existing("OFFICIAL_STAT", true)),
  true,
);

if (failures > 0) {
  console.error(`\n${failures} visibility check(s) failed`);
  process.exit(1);
}
console.log("\nAll visibility checks passed.");
