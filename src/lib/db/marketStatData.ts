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
      : // A replaced row must not keep a stale verified stamp.
        { verifiedById: null, verifiedAt: null }),
  };
}

// ---------- Conflict setting (Align Step 3) ----------

/**
 * What upsertMarketStat does when a row already exists for the same place +
 * type + month:
 * - "replace" (default): overwrite it — the single-row form and the admin
 *   official import;
 * - "skip": leave it alone and report skipped — agency uploads, so a hidden
 *   submission can never replace a public figure;
 * - "replace-derived-only": overwrite only a row that is itself
 *   LISTING_DERIVED (or an invented sample row); skip anything real that is
 *   official, verified or user-submitted — the listing-averages job.
 */
export type StatConflictMode = "replace" | "skip" | "replace-derived-only";

// Compared as a plain string so this compiles before the LISTING_DERIVED enum
// value exists in the schema (Build C adds it with its own migration).
const LISTING_DERIVED_PROVENANCE = "LISTING_DERIVED";

/** Pure decision, exported for tests: may this write replace `existing`? */
export function mayReplaceExistingStat(
  mode: StatConflictMode,
  existing: { provenance: string; isSample: boolean },
): boolean {
  if (mode === "replace") return true;
  if (mode === "skip") return false;
  return existing.isSample || existing.provenance === LISTING_DERIVED_PROVENANCE;
}
