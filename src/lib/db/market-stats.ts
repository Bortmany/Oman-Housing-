import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma, PropertyType } from "@prisma/client";
import {
  dropSupersededSampleStats,
  hideSupersededSampleProperties,
  isSampleOnlySite,
  latestVisibleStat,
  latestVisibleStatPerNeighborhood,
} from "./sampleData";
import { publicStatWhere } from "../statVisibility";
import { latestAreaFigures } from "../areaFigures";
import {
  buildMarketStatWriteData,
  mayReplaceExistingStat,
  type MarketStatWriteInput,
  type StatConflictMode,
} from "./marketStatData";
import { realActiveListingKeysFor } from "./listings";

// ---------------------------------------------------------------------------
// Queries for the market dashboard.
//
// The public market pages (dashboard, neighborhood page, compare) show the
// same figures to every visitor, so these read-only queries are served from
// Next's server-side data cache for up to 5 minutes. Admin saves call
// updateTag(MARKET_DATA_CACHE_TAG) so the owner's edits show up immediately.
// Only these shared queries are cached — never per-user or admin reads, and
// never whole pages (the header renders each visitor's session state).
//
// The cache stores plain JSON: on a cache hit, Date columns come back as ISO
// strings (revived below before rows leave this module) and Decimal columns
// come back as plain strings (fine as-is — every figure is displayed via
// toString()/Number(), matching the "Decimal to string at the boundary" rule).
//
// Sample rows (seeded demonstration data) step aside for real rows by the one
// rule in ./sampleData.ts: a sample figure is hidden once a real figure exists
// for the same place, type and month. "Latest" means latest AFTER hiding.
// Every row returned carries `isSample` so the page can draw the right badge.
//
// Before that, every public query keeps only publicly visible rows via
// publicStatWhere (src/lib/statVisibility.ts): an agency figure the owner has
// not approved yet is never public and never hides a sample figure.
// ---------------------------------------------------------------------------

/** One tag covers everything the public market pages read. */
export const MARKET_DATA_CACHE_TAG = "market-data";

const CACHE_OPTIONS = { revalidate: 300, tags: [MARKET_DATA_CACHE_TAG] };

function reviveDate(value: Date): Date;
function reviveDate(value: Date | null): Date | null;
function reviveDate(value: Date | null): Date | null {
  return value == null ? null : new Date(value);
}

const cachedLatestStatsByNeighborhood = unstable_cache(
  async (propertyType: PropertyType) => {
    // Every neighbourhood row for the type (a few hundred; cached), so the
    // hiding rule runs before "latest" is picked.
    const rows = await prisma.marketStat.findMany({
      where: publicStatWhere({ neighborhoodId: { not: null }, propertyType }),
      orderBy: [{ neighborhoodId: "asc" }, { periodStart: "desc" }],
      include: { neighborhood: { include: { city: true } } },
    });
    return latestVisibleStatPerNeighborhood(rows);
  },
  ["latest-stats-by-neighborhood-v3"],
  CACHE_OPTIONS,
);

/** Latest stat per neighborhood for one property type. */
export async function latestStatsByNeighborhood(propertyType: PropertyType) {
  const rows = await cachedLatestStatsByNeighborhood(propertyType);
  return rows.map((row) => ({
    ...row,
    periodStart: reviveDate(row.periodStart),
    verifiedAt: reviveDate(row.verifiedAt),
    createdAt: reviveDate(row.createdAt),
    updatedAt: reviveDate(row.updatedAt),
  }));
}

const cachedLatestNeighborhoodStat = unstable_cache(
  async (neighborhoodId: string, propertyType: PropertyType) => {
    // A superseded sample row always shares its month with the real row that
    // hides it, so the newest few rows are enough to pick "latest after hiding".
    const rows = await prisma.marketStat.findMany({
      where: publicStatWhere({ neighborhoodId, propertyType }),
      orderBy: { periodStart: "desc" },
      take: 6,
    });
    return latestVisibleStat(rows);
  },
  ["latest-neighborhood-stat-v3"],
  CACHE_OPTIONS,
);

/** Latest stat for one neighborhood + property type (compare page cards). */
export async function latestNeighborhoodStat(
  neighborhoodId: string,
  propertyType: PropertyType,
) {
  const row = await cachedLatestNeighborhoodStat(neighborhoodId, propertyType);
  if (!row) return null;
  return {
    ...row,
    periodStart: reviveDate(row.periodStart),
    verifiedAt: reviveDate(row.verifiedAt),
    createdAt: reviveDate(row.createdAt),
    updatedAt: reviveDate(row.updatedAt),
  };
}

const cachedNeighborhoodTrends = unstable_cache(
  async (
    neighborhoodIds: string[],
    propertyType: PropertyType,
    months: number,
  ) => {
    const rows = await prisma.marketStat.findMany({
      where: publicStatWhere({
        neighborhoodId: { in: neighborhoodIds },
        propertyType,
      }),
      // Newest first so `take` keeps the most recent months (flipped back to
      // oldest-first below), not the oldest ones once history grows longer.
      // Twice the window leaves room for a real and a sample row sharing a
      // month before the hiding rule runs.
      orderBy: { periodStart: "desc" },
      take: months * neighborhoodIds.length * 2,
      select: {
        neighborhoodId: true,
        propertyType: true,
        periodStart: true,
        avgSalePrice: true,
        avgRentMonthly: true,
        avgPricePerSqm: true,
        grossYieldPct: true,
        sampleSize: true,
        provenance: true,
        confidence: true,
        isSample: true,
        sourceUrl: true,
      },
    });
    // Apply the hiding rule, then keep each neighbourhood's newest `months`.
    const perHood = new Map<string | null, number>();
    return dropSupersededSampleStats(rows).filter((row) => {
      const used = perHood.get(row.neighborhoodId) ?? 0;
      perHood.set(row.neighborhoodId, used + 1);
      return used < months;
    });
  },
  ["neighborhood-trends-latest-v5"],
  CACHE_OPTIONS,
);

/** Monthly history for a set of neighborhoods (for trend charts). */
export async function neighborhoodTrends(
  neighborhoodIds: string[],
  propertyType: PropertyType,
  months = 24,
) {
  const rows = await cachedNeighborhoodTrends(
    neighborhoodIds,
    propertyType,
    months,
  );
  return rows
    .map((row) => ({
      ...row,
      periodStart: reviveDate(row.periodStart),
    }))
    .reverse();
}

const cachedAreaFigures = unstable_cache(
  async (governorateIds: string[] | "all", cityIds: string[]) => {
    // Whole-area rows only (never a neighbourhood's own), and only real
    // official statistics: the card is titled "official", so a sample,
    // estimated or submitted figure must never appear under that title.
    const places: Prisma.MarketStatWhereInput[] =
      governorateIds === "all"
        ? [{ governorateId: { not: null }, cityId: null }]
        : [{ governorateId: { in: governorateIds }, cityId: null }];
    if (cityIds.length > 0) places.push({ cityId: { in: cityIds } });
    const rows = await prisma.marketStat.findMany({
      where: publicStatWhere({
        neighborhoodId: null,
        provenance: "OFFICIAL_STAT",
        isSample: false,
        OR: places,
      }),
      orderBy: { periodStart: "desc" },
      take: 1500,
      include: { governorate: true, city: true },
    });
    return latestAreaFigures(rows);
  },
  ["area-figures-v1"],
  CACHE_OPTIONS,
);

/**
 * Latest official whole-area figures (one per place and property type) for
 * the given governorates ("all" = every governorate) and cities. Shown only
 * as their own labelled card, never merged into a neighbourhood's figures.
 */
export async function latestAreaFiguresFor(
  governorateIds: string[] | "all",
  cityIds: string[] = [],
) {
  const rows = await cachedAreaFigures(
    governorateIds === "all" ? "all" : [...governorateIds].sort(),
    [...cityIds].sort(),
  );
  return rows.map((row) => ({
    ...row,
    periodStart: reviveDate(row.periodStart),
    verifiedAt: reviveDate(row.verifiedAt),
    createdAt: reviveDate(row.createdAt),
    updatedAt: reviveDate(row.updatedAt),
  }));
}

const cachedSampleOnlySite =unstable_cache(
  async () =>
    isSampleOnlySite(
      await prisma.marketStat.count({
        where: publicStatWhere({ isSample: false }),
      }),
    ),
  ["sample-only-site-v2"],
  CACHE_OPTIONS,
);

/**
 * True while the whole site holds only sample market figures (the home page
 * then softens its promise). Decided from the data, never a switch.
 */
export async function siteHasOnlySampleData(): Promise<boolean> {
  return cachedSampleOnlySite();
}

const cachedAllNeighborhoods = unstable_cache(
  async () =>
    prisma.neighborhood.findMany({
      orderBy: { nameEn: "asc" },
      include: { city: { include: { governorate: true } } },
    }),
  ["all-neighborhoods"],
  CACHE_OPTIONS,
);

export async function allNeighborhoods() {
  // No Date or heavy columns in this shape — safe to return straight from cache.
  return cachedAllNeighborhoods();
}

const cachedNeighborhoodBySlug = unstable_cache(
  async (slug: string) => {
    const hood = await prisma.neighborhood.findUnique({
      where: { slug },
      include: {
        city: { include: { governorate: true } },
        properties: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!hood) return null;
    // Sample homes step aside once a real live listing exists in this
    // neighbourhood for the same property type.
    const realKeys = await realActiveListingKeysFor({ neighborhoodId: hood.id });
    return {
      ...hood,
      properties: hideSupersededSampleProperties(hood.properties, realKeys),
    };
  },
  ["neighborhood-by-slug-v2"],
  CACHE_OPTIONS,
);

export async function neighborhoodBySlug(slug: string) {
  const hood = await cachedNeighborhoodBySlug(slug);
  if (!hood) return null;
  return {
    ...hood,
    properties: hood.properties.map((p) => ({
      ...p,
      verifiedAt: reviveDate(p.verifiedAt),
      createdAt: reviveDate(p.createdAt),
      updatedAt: reviveDate(p.updatedAt),
    })),
  };
}

// ---------------------------------------------------------------------------
// Writing stats. The @@unique on MarketStat contains nullable scope columns,
// which Postgres treats as always-distinct — so scope uniqueness is enforced
// HERE. All stat writes must go through upsertMarketStat.
// ---------------------------------------------------------------------------

export type StatScope =
  | { kind: "national" }
  | { kind: "governorate"; id: string }
  | { kind: "city"; id: string }
  | { kind: "neighborhood"; id: string };

export type { MarketStatMetrics, StatConflictMode } from "./marketStatData";

/**
 * The only path for stat writes. A write through the app is never sample:
 * when it replaces the seeded sample row for the same place+type+month it
 * does so IN PLACE (isSample false, every unsupplied metric cleared — see
 * buildMarketStatWriteData). `onConflict` (default "replace") decides what
 * happens when a row already exists; `skipped` is true when nothing was
 * written. Server actions that call this must also call
 * updateTag(MARKET_DATA_CACHE_TAG) — see src/lib/db/cacheRefresh.test.ts.
 */
export async function upsertMarketStat(
  args: MarketStatWriteInput & {
    scope: StatScope;
    propertyType: PropertyType | null;
    periodStart: Date;
    onConflict?: StatConflictMode;
  },
): Promise<{ id: string; updated: boolean; skipped: boolean; replacedSample: boolean }> {
  const scopeWhere: Prisma.MarketStatWhereInput = {
    governorateId: args.scope.kind === "governorate" ? args.scope.id : null,
    cityId: args.scope.kind === "city" ? args.scope.id : null,
    neighborhoodId: args.scope.kind === "neighborhood" ? args.scope.id : null,
  };

  const data = buildMarketStatWriteData(args);

  const existing = await prisma.marketStat.findFirst({
    where: {
      ...scopeWhere,
      propertyType: args.propertyType,
      periodStart: args.periodStart,
    },
    // Real row first if (against the rule) a real and a sample row share a key.
    orderBy: { isSample: "asc" },
    select: { id: true, provenance: true, isSample: true },
  });

  if (existing) {
    if (!mayReplaceExistingStat(args.onConflict ?? "replace", existing)) {
      return { id: existing.id, updated: false, skipped: true, replacedSample: false };
    }
    await prisma.marketStat.update({ where: { id: existing.id }, data });
    return { id: existing.id, updated: true, skipped: false, replacedSample: existing.isSample };
  }

  const created = await prisma.marketStat.create({
    data: {
      ...data,
      governorateId:
        args.scope.kind === "governorate" ? args.scope.id : null,
      cityId: args.scope.kind === "city" ? args.scope.id : null,
      neighborhoodId:
        args.scope.kind === "neighborhood" ? args.scope.id : null,
      propertyType: args.propertyType,
      periodStart: args.periodStart,
    },
  });
  return { id: created.id, updated: false, skipped: false, replacedSample: false };
}
