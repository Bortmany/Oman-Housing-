// Pure functions — no UI, no I/O.
//
// Turns one neighbourhood's monthly market stats into the small summary the
// home page shows: the recent price line, the change over that window, and
// the badge it must carry. A change worked out from several stored figures is
// only as trustworthy as the weakest of them, so the badge takes the weakest
// source and the lowest confidence among the points used — never better.
// A trend built from any sample (invented demonstration) point is sample.

import type { DataProvenance } from "@prisma/client";
import { PROVENANCE_VALUES } from "./provenance";

export type TrendInputPoint = {
  periodStart: Date;
  value: number | null;
  provenance: DataProvenance;
  confidence: number;
  isSample: boolean;
  /** Listings behind a LISTING_DERIVED average; null/absent for other sources. */
  sampleSize?: number | null;
};

export type TrendSummary = {
  series: number[];
  changePct: number;
  from: Date;
  to: Date;
  provenance: DataProvenance;
  confidence: number;
  /** true when any point used is sample data — the badge then says "Sample data". */
  isSample: boolean;
  /** Listings behind the newest LISTING_DERIVED point used (null when none). */
  sampleSize: number | null;
};

// Strongest first. Averages from live listings (asking prices) rank below a
// user-submitted figure and above a model estimate. LISTING_DERIVED is not in
// PROVENANCE_VALUES (the manual-form list), so the order is spelled out here.
const STRENGTH_ORDER: readonly DataProvenance[] = [
  ...PROVENANCE_VALUES.slice(0, 3),
  "LISTING_DERIVED",
  ...PROVENANCE_VALUES.slice(3),
];

/** The weaker of the listed sources (STRENGTH_ORDER runs strongest first). */
export function weakestProvenance(values: DataProvenance[]): DataProvenance {
  let worst = 0;
  for (const v of values) worst = Math.max(worst, STRENGTH_ORDER.indexOf(v));
  return STRENGTH_ORDER[worst];
}

/**
 * The last `months` months of change (so `months + 1` monthly points at most).
 * Returns null when there are not two usable figures to compare — the card is
 * then simply not shown, rather than inventing a change.
 */
export function summarizeTrend(
  points: TrendInputPoint[],
  months = 12,
): TrendSummary | null {
  const usable = points
    .filter((p) => p.value != null && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
    .slice(-(months + 1));
  if (usable.length < 2) return null;
  const first = usable[0].value!;
  const last = usable[usable.length - 1].value!;
  const newestDerived = [...usable].reverse().find((p) => p.provenance === "LISTING_DERIVED");
  return {
    series: usable.map((p) => p.value!),
    changePct: ((last - first) / first) * 100,
    from: usable[0].periodStart,
    to: usable[usable.length - 1].periodStart,
    provenance: weakestProvenance(usable.map((p) => p.provenance)),
    confidence: Math.min(...usable.map((p) => p.confidence)),
    isSample: usable.some((p) => p.isSample),
    sampleSize: newestDerived?.sampleSize ?? null,
  };
}

/** "+5.0%" / "-3.4%": always one decimal and a sign (Latin digits in both languages). */
export function formatGrowthPct(changePct: number, locale: string): string {
  if (!Number.isFinite(changePct)) return "—";
  const n = new Intl.NumberFormat(locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM", {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(changePct);
  return `${n}%`;
}
