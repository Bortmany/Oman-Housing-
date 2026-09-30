// Pure function — no I/O. Builds the row data that upsertMarketStat writes,
// so the rules for an app write can be tested without a database
// (sampleData.test.ts). Rules:
// - a figure written through the app is NEVER sample (`isSample: false`),
//   so when it replaces a seeded sample row in place, that row becomes real;
// - every metric the caller did not supply is cleared to null, so a real row
//   can never keep an invented sample size, median or yield from the seed.

import type { DataProvenance } from "@prisma/client";

export type MarketStatMetrics = {
  avgSalePrice?: number | null;
  medianSalePrice?: number | null;
  avgRentMonthly?: number | null;
  avgPricePerSqm?: number | null;
  grossYieldPct?: number | null;
  transactionCount?: number | null;
  sampleSize?: number | null;
};

export const MARKET_STAT_METRIC_FIELDS = [
  "avgSalePrice",
  "medianSalePrice",
  "avgRentMonthly",
  "avgPricePerSqm",
  "grossYieldPct",
  "transactionCount",
  "sampleSize",
] as const satisfies ReadonlyArray<keyof MarketStatMetrics>;

export type MarketStatWriteInput = {
  metrics: MarketStatMetrics;
  provenance: DataProvenance;
  confidence: number;
  sourceNote?: string | null;
  sourceUrl?: string | null;
  verifiedById?: string | null;
};

export function buildMarketStatWriteData(
  args: MarketStatWriteInput,
  now: Date = new Date(),
) {
  const metrics = {} as Record<(typeof MARKET_STAT_METRIC_FIELDS)[number], number | null>;
  for (const field of MARKET_STAT_METRIC_FIELDS) {
    metrics[field] = args.metrics[field] ?? null;
  }
  return {
    ...metrics,
    provenance: args.provenance,
    confidence: args.confidence,
    sourceNote: args.sourceNote ?? null,
    sourceUrl: args.sourceUrl ?? null,
    isSample: false,
    ...(args.provenance === "VERIFIED"
      ? { verifiedById: args.verifiedById ?? null, verifiedAt: now }
      : {}),
  };
}
