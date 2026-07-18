import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DataProvenance, Prisma, PropertyType } from "@prisma/client";

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
  async (propertyType: PropertyType) =>
    prisma.marketStat.findMany({
      where: { neighborhoodId: { not: null }, propertyType },
      orderBy: [{ neighborhoodId: "asc" }, { periodStart: "desc" }],
      distinct: ["neighborhoodId"],
      include: { neighborhood: { include: { city: true } } },
    }),
  ["latest-stats-by-neighborhood"],
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
  async (neighborhoodId: string, propertyType: PropertyType) =>
    prisma.marketStat.findFirst({
      where: { neighborhoodId, propertyType },
      orderBy: { periodStart: "desc" },
    }),
  ["latest-neighborhood-stat"],
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
  ) =>
    prisma.marketStat.findMany({
      where: {
        neighborhoodId: { in: neighborhoodIds },
        propertyType,
      },
      orderBy: { periodStart: "asc" },
      take: months * neighborhoodIds.length,
      select: {
        neighborhoodId: true,
        periodStart: true,
        avgSalePrice: true,
        avgRentMonthly: true,
        avgPricePerSqm: true,
        grossYieldPct: true,
        provenance: true,
        confidence: true,
      },
    }),
  ["neighborhood-trends"],
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
  return rows.map((row) => ({
    ...row,
    periodStart: reviveDate(row.periodStart),
  }));
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
  async (slug: string) =>
    prisma.neighborhood.findUnique({
      where: { slug },
      include: {
        city: { include: { governorate: true } },
        properties: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
  ["neighborhood-by-slug"],
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

export type MarketStatMetrics = {
  avgSalePrice?: number | null;
  medianSalePrice?: number | null;
  avgRentMonthly?: number | null;
  avgPricePerSqm?: number | null;
  grossYieldPct?: number | null;
  transactionCount?: number | null;
  sampleSize?: number | null;
};

export async function upsertMarketStat(args: {
  scope: StatScope;
  propertyType: PropertyType | null;
  periodStart: Date;
  metrics: MarketStatMetrics;
  provenance: DataProvenance;
  confidence: number;
  sourceNote?: string | null;
  sourceUrl?: string | null;
  verifiedById?: string | null;
}): Promise<{ id: string; updated: boolean }> {
  const scopeWhere: Prisma.MarketStatWhereInput = {
    governorateId: args.scope.kind === "governorate" ? args.scope.id : null,
    cityId: args.scope.kind === "city" ? args.scope.id : null,
    neighborhoodId: args.scope.kind === "neighborhood" ? args.scope.id : null,
  };

  const data = {
    ...args.metrics,
    provenance: args.provenance,
    confidence: args.confidence,
    sourceNote: args.sourceNote ?? null,
    sourceUrl: args.sourceUrl ?? null,
    ...(args.provenance === "VERIFIED"
      ? { verifiedById: args.verifiedById ?? null, verifiedAt: new Date() }
      : {}),
  };

  const existing = await prisma.marketStat.findFirst({
    where: {
      ...scopeWhere,
      propertyType: args.propertyType,
      periodStart: args.periodStart,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.marketStat.update({ where: { id: existing.id }, data });
    return { id: existing.id, updated: true };
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
  return { id: created.id, updated: false };
}
