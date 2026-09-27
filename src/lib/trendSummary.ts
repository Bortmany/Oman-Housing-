// Pure functions — no UI, no I/O.
//
// Turns one neighbourhood's monthly market stats into the small summary the
// home page shows: the recent price line, the change over that window, and
// the badge it must carry. A change worked out from several stored figures is
// only as trustworthy as the weakest of them, so the badge takes the weakest
// source and the lowest confidence among the points used — never better.

import type { DataProvenance } from "@prisma/client";
import { PROVENANCE_VALUES } from "./provenance";

export type TrendInputPoint = {
  periodStart: Date;
  value: number | null;
  provenance: DataProvenance;
  confidence: number;
};

export type TrendSummary = {
  series: number[];
  changePct: number;
  from: Date;
  to: Date;
  provenance: DataProvenance;
  confidence: number;
};

/** The weaker of the listed sources (PROVENANCE_VALUES runs strongest first). */
export function weakestProvenance(values: DataProvenance[]): DataProvenance {
  let worst = 0;
  for (const v of values) worst = Math.max(worst, PROVENANCE_VALUES.indexOf(v));
  return PROVENANCE_VALUES[worst];
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
  return {
    series: usable.map((p) => p.value!),
    changePct: ((last - first) / first) * 100,
    from: usable[0].periodStart,
    to: usable[usable.length - 1].periodStart,
    provenance: weakestProvenance(usable.map((p) => p.provenance)),
    confidence: Math.min(...usable.map((p) => p.confidence)),
  };
}
