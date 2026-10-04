// Pure logic for the price map on /market (no I/O, no Prisma client).
// Tested in priceMap.test.ts (runs in `npm test`).
//
// Core guarantee (house rule 1): the legend names the WEAKEST source among the
// figures that produced a coloured circle. Weakest first:
//   Sample data < AI estimated < User submitted < From live listings
//   < Official statistic < Verified
// Ties go to the lowest confidence. A circle with no price has no figure, so
// it never counts.

import { PRICE_SCALE } from "./chartPalette";

export type SourceKind =
  | "AI_ESTIMATED"
  | "USER_SUBMITTED"
  | "LISTING_DERIVED"
  | "OFFICIAL_STAT"
  | "VERIFIED";

export type SourceInput = {
  provenance: SourceKind;
  confidence: number;
  isSample: boolean;
};

/** Lower = weaker. Sample data is ranked below everything else. */
const RANK: Record<SourceKind, number> = {
  AI_ESTIMATED: 1,
  USER_SUBMITTED: 2,
  LISTING_DERIVED: 3,
  OFFICIAL_STAT: 4,
  VERIFIED: 5,
};

function rankOf(row: SourceInput): number {
  return row.isSample ? 0 : RANK[row.provenance];
}

/**
 * The weakest source among the rows, or null when there are none.
 * A sample row beats (is weaker than) any number of official rows.
 */
export function weakestInput<T extends SourceInput>(rows: T[]): T | null {
  let weakest: T | null = null;
  for (const row of rows) {
    if (weakest == null) {
      weakest = row;
      continue;
    }
    const a = rankOf(row);
    const b = rankOf(weakest);
    if (a < b || (a === b && row.confidence < weakest.confidence)) {
      weakest = row;
    }
  }
  return weakest;
}

// ---------- Colour scale ----------

/**
 * Step boundaries from the values on screen: equal-count groups (quintiles).
 * Returns the LOWER bound of each step, ascending. With fewer than 5 distinct
 * values there are fewer steps — a step no circle uses is never drawn.
 */
export function buildBreaks(values: number[], maxSteps = PRICE_SCALE.length): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const distinct = new Set(sorted).size;
  const steps = Math.min(maxSteps, distinct);
  const lowers: number[] = [];
  for (let i = 0; i < steps; i++) {
    let v = sorted[Math.floor((i * sorted.length) / steps)];
    const prev = lowers[lowers.length - 1];
    if (prev !== undefined && v <= prev) {
      // The group boundary landed on a repeated value: take the next higher
      // value instead, so every step still holds at least one circle.
      const next = sorted.find((x) => x > prev);
      if (next === undefined) break;
      v = next;
    }
    lowers.push(v);
  }
  return lowers;
}

/** Which step (0-based) a value falls in. Below the first bound = step 0. */
export function bucketFor(value: number, breaks: number[]): number {
  let step = 0;
  for (let i = 0; i < breaks.length; i++) {
    if (value >= breaks[i]) step = i;
  }
  return step;
}

/** The colour for each step, spread across the 5-colour scale. */
export function scaleColors(steps: number): string[] {
  if (steps <= 0) return [];
  if (steps === 1) return [PRICE_SCALE[2]];
  const top = PRICE_SCALE.length - 1;
  return Array.from({ length: steps }, (_, i) => PRICE_SCALE[Math.round((i * top) / (steps - 1))]);
}

export const MIN_RADIUS = 12;
export const MAX_RADIUS = 28;
/** Sample size at which a circle reaches full size. */
const FULL_SIZE_AT = 100;

/** Circle radius in px: square-root of the sample size, 12..28. Missing = 12. */
export function radiusFor(sampleSize: number | null | undefined): number {
  if (sampleSize == null || !Number.isFinite(sampleSize) || sampleSize <= 0) {
    return MIN_RADIUS;
  }
  const share = Math.min(1, Math.sqrt(sampleSize / FULL_SIZE_AT));
  return Math.round((MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * share) * 10) / 10;
}

// ---------- Assembling the map ----------

export type PriceMapInput = {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Average price per sqm in OMR; null = no figure. */
  price: number | null;
  sampleSize: number | null;
  /** Latest month of the figure (any printable label), null with no figure. */
  periodStart: Date | null;
  provenance: SourceKind | null;
  confidence: number;
  isSample: boolean;
};

export type PriceMapPoint = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  price: number | null;
  sampleSize: number | null;
  periodStart: string | null;
  /** True when this area's figure is sample data (popup says so). */
  isSample: boolean;
  /** Step index, or null for a "No data" circle. */
  step: number | null;
  color: string | null;
  radius: number;
};

export type PriceMapLegendStep = { color: string; from: number; to: number };

export type PriceMapModel = {
  points: PriceMapPoint[];
  steps: PriceMapLegendStep[];
  /** Weakest source among the coloured circles; null when none is coloured. */
  weakest: SourceInput | null;
  /** Areas with a figure but no coordinates (not drawn). */
  unplaced: number;
  /** Any area at all drawn with no figure. */
  hasNoData: boolean;
};

export const NO_DATA_RADIUS = 6;

export function buildPriceMap(rows: PriceMapInput[]): PriceMapModel {
  const hasFigure = (r: PriceMapInput) =>
    r.price != null && Number.isFinite(r.price);
  const placed = (r: PriceMapInput) =>
    r.lat != null && r.lng != null && Number.isFinite(r.lat) && Number.isFinite(r.lng);

  const coloured = rows.filter((r) => placed(r) && hasFigure(r));
  const unplaced = rows.filter((r) => !placed(r) && hasFigure(r)).length;

  // Steps are whole OMR (the legend and popups show whole numbers), so two
  // neighbouring legend ranges can never overlap or leave a gap.
  const breaks = buildBreaks(coloured.map((r) => Math.round(r.price as number)));
  const colors = scaleColors(breaks.length);
  const max = Math.max(...coloured.map((r) => Math.round(r.price as number)));

  const points: PriceMapPoint[] = [];
  for (const r of rows) {
    if (!placed(r)) continue;
    const base = {
      slug: r.slug,
      name: r.name,
      lat: r.lat as number,
      lng: r.lng as number,
      price: r.price,
      sampleSize: r.sampleSize,
      periodStart: r.periodStart ? r.periodStart.toISOString() : null,
      isSample: hasFigure(r) ? r.isSample : false,
    };
    if (hasFigure(r)) {
      const step = bucketFor(Math.round(r.price as number), breaks);
      points.push({
        ...base,
        step,
        color: colors[step],
        radius: radiusFor(r.sampleSize),
      });
    } else {
      points.push({ ...base, step: null, color: null, radius: NO_DATA_RADIUS });
    }
  }

  const steps: PriceMapLegendStep[] = breaks.map((from, i) => ({
    color: colors[i],
    from,
    // Each range ends one below the next one starts (OMR 311–426, 427–585, …).
    to: i + 1 < breaks.length ? Math.max(breaks[i + 1] - 1, from) : max,
  }));

  const sources: SourceInput[] = coloured
    .filter((r) => r.provenance != null)
    .map((r) => ({
      provenance: r.provenance as SourceKind,
      confidence: r.confidence,
      isSample: r.isSample,
    }));

  return {
    points,
    steps,
    weakest: weakestInput(sources),
    unplaced,
    hasNoData: points.some((p) => p.step == null),
  };
}
