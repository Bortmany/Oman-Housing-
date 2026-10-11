// The ONE reading of a property-search URL: the search page and (later) the
// saved-search alert job both call `parseSearchFilters`, so a saved search
// means exactly the same thing in both places. Pure functions, no I/O.
//
// Never trust the raw URL: anything unknown, malformed or out of range is
// ignored, never thrown, and the map box is all-or-nothing.

import type {
  ListingType,
  OwnershipEligibility,
  PropertyType,
} from "@prisma/client";
import type { SearchFilters } from "./db/listings";

/** Newest-first cap on public search results (the page's "newest 60" note). */
export const DEFAULT_SEARCH_LIMIT = 60;

export const PROPERTY_TYPES: ReadonlySet<string> = new Set([
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
]);
export const OWNERSHIP_VALUES: ReadonlySet<string> = new Set([
  "OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN",
]);

/** A map box in decimal degrees: north, south, east, west. */
export type Bounds = { n: number; s: number; e: number; w: number };

export const BOUNDS_KEYS = ["n", "s", "e", "w"] as const;

type RawParams = Record<string, string | undefined> | URLSearchParams;

function read(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  return params[key];
}

/** A non-negative finite number from a URL value, else undefined. */
function nonNegative(v: string | undefined): number | undefined {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Decimal degrees rounded to 4 places (about 11 m). */
export function roundDegrees(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** One coordinate from text: plain decimal only, finite, else undefined. */
function degrees(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const text = v.trim();
  if (text === "" || text.length > 24 || !/^-?\d+(\.\d+)?$/.test(text)) {
    return undefined;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** True when the four numbers form a usable box (the rules in spec B2). */
export function isValidBounds(b: Bounds): boolean {
  return (
    [b.n, b.s, b.e, b.w].every(Number.isFinite) &&
    b.s >= -90 && b.n <= 90 && b.s < b.n &&
    b.w >= -180 && b.e <= 180 && b.w < b.e
  );
}

/**
 * The map box from a URL: all four present and valid, or nothing. A box that
 * is out of range, upside down, or only half there is ignored entirely.
 * Valid values are rounded to 4 places.
 */
export function parseBounds(params: RawParams): Bounds | undefined {
  const n = degrees(read(params, "n"));
  const s = degrees(read(params, "s"));
  const e = degrees(read(params, "e"));
  const w = degrees(read(params, "w"));
  if (n == null || s == null || e == null || w == null) return undefined;
  const box = {
    n: roundDegrees(n),
    s: roundDegrees(s),
    e: roundDegrees(e),
    w: roundDegrees(w),
  };
  return isValidBounds(box) ? box : undefined;
}

/**
 * Turn what the live map reports (which can overshoot when zoomed far out,
 * e.g. west of -180) into a box we are willing to write to the URL: clamped
 * to the world and rounded. Undefined when nothing usable is left.
 */
export function clampBounds(raw: Bounds): Bounds | undefined {
  if (![raw.n, raw.s, raw.e, raw.w].every(Number.isFinite)) return undefined;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const box = {
    n: roundDegrees(clamp(raw.n, -90, 90)),
    s: roundDegrees(clamp(raw.s, -90, 90)),
    e: roundDegrees(clamp(raw.e, -180, 180)),
    w: roundDegrees(clamp(raw.w, -180, 180)),
  };
  return isValidBounds(box) ? box : undefined;
}

/** The four values as URL strings (empty object when there is no box). */
export function boundsToQuery(b: Bounds | undefined): Record<string, string> {
  return b
    ? { n: String(b.n), s: String(b.s), e: String(b.e), w: String(b.w) }
    : {};
}

function isBoundsKey(key: string): boolean {
  return (BOUNDS_KEYS as readonly string[]).includes(key);
}

/**
 * The query for pressing "Search this area": the current filters, minus the
 * neighbourhood (the map area replaces it) and minus any older box, plus the
 * new box. Every other filter stays.
 */
export function areaSearchQuery(
  current: Record<string, string | undefined>,
  box: Bounds,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (!value || key === "hood" || isBoundsKey(key)) continue;
    out[key] = value;
  }
  return { ...out, ...boundsToQuery(box) };
}

/** The current filters minus the map box ("Clear map area"). */
export function withoutArea(
  current: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (value && !isBoundsKey(key)) out[key] = value;
  }
  return out;
}

/** Everything the search understands, validated, from a URL or its parts. */
export function parseSearchFilters(params: RawParams): SearchFilters {
  const type = read(params, "type") ?? "";
  const listingType = read(params, "listingType");
  const ownership = read(params, "ownership") ?? "";
  return {
    neighborhoodSlug: read(params, "hood") || undefined,
    type: PROPERTY_TYPES.has(type) ? (type as PropertyType) : undefined,
    listingType:
      listingType === "SALE" || listingType === "RENT"
        ? (listingType as ListingType)
        : undefined,
    minPrice: nonNegative(read(params, "minPrice")),
    maxPrice: nonNegative(read(params, "maxPrice")),
    minBedrooms: nonNegative(read(params, "beds")),
    ownership: OWNERSHIP_VALUES.has(ownership)
      ? (ownership as OwnershipEligibility)
      : undefined,
    bounds: parseBounds(params),
  };
}

/** Do two boxes show (nearly) the same area? */
export function sameArea(a: Bounds, b: Bounds, tolerance = 0.0005): boolean {
  return (
    Math.abs(a.n - b.n) <= tolerance &&
    Math.abs(a.s - b.s) <= tolerance &&
    Math.abs(a.e - b.e) <= tolerance &&
    Math.abs(a.w - b.w) <= tolerance
  );
}
