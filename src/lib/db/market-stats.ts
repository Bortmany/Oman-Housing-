import { prisma } from "@/lib/prisma";
import type { DataProvenance, Prisma, PropertyType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Queries for the market dashboard.
// ---------------------------------------------------------------------------

/** Latest stat per neighborhood for one property type. */
export async function latestStatsByNeighborhood(propertyType: PropertyType) {
  return prisma.marketStat.findMany({
    where: { neighborhoodId: { not: null }, propertyType },
    orderBy: [{ neighborhoodId: "asc" }, { periodStart: "desc" }],
    distinct: ["neighborhoodId"],
    include: { neighborhood: { include: { city: true } } },
  });
}

/** Monthly history for a set of neighborhoods (for trend charts). */
export async function neighborhoodTrends(
  neighborhoodIds: string[],
  propertyType: PropertyType,
  months = 24,
) {
  return prisma.marketStat.findMany({
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
  });
}

export async function allNeighborhoods() {
  return prisma.neighborhood.findMany({
    orderBy: { nameEn: "asc" },
    include: { city: { include: { governorate: true } } },
  });
}

export async function neighborhoodBySlug(slug: string) {
  return prisma.neighborhood.findUnique({
    where: { slug },
    include: {
      city: { include: { governorate: true } },
      properties: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
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
