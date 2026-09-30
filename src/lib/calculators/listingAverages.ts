// Pure function — no I/O, no database. Works out average asking prices from
// live listings (Align Step 3, Build C). The database part lives in
// src/lib/listingAveragesJob.ts; tests are in calculators.test.ts.
//
// Rules (from the spec):
// - grouped by place (neighbourhood, plus city and governorate roll-ups
//   pooled from the listings beneath them) and by property type. There is NO
//   "all types" row: villas and apartments in one average would mislead;
// - sale listings give avgSalePrice, medianSalePrice and avgPricePerSqm (the
//   last only from listings with an area above 0, and it needs its own 5);
// - rent listings give avgRentMonthly (annual rents divided by 12 first).
//   Rent and sale are never mixed;
// - every metric needs at least 5 listings. Fewer: the metric is not
//   produced, and a group with no metric produces no row;
// - confidence is 0.30 at 5 listings, +0.02 per extra listing, capped at 0.60;
// - listings with a non-positive price are ignored;
// - money is worked out in whole baisa (integers) so it is decimal-safe, then
//   shown with 3 decimals (house rule 2).

export const MIN_LISTINGS = 5;
export const DERIVED_CONFIDENCE_FLOOR = 0.3;
export const DERIVED_CONFIDENCE_STEP = 0.02;
export const DERIVED_CONFIDENCE_CAP = 0.6;

export type AveragesListing = {
  listingType: "SALE" | "RENT";
  /** OMR */
  price: number;
  rentPeriod: "MONTHLY" | "ANNUAL" | null;
  areaSqm: number | null;
  propertyType: string;
  neighborhoodId: string;
  cityId: string | null;
  governorateId: string | null;
};

export type AveragesScope =
  | { kind: "governorate"; id: string }
  | { kind: "city"; id: string }
  | { kind: "neighborhood"; id: string };

export type AveragesRow = {
  scope: AveragesScope;
  propertyType: string;
  avgSalePrice: number | null;
  medianSalePrice: number | null;
  avgRentMonthly: number | null;
  avgPricePerSqm: number | null;
  /** The smallest listing count among the metrics this row contains. */
  sampleSize: number;
  confidence: number;
  /** Exact counts, for the source note. Null when that side has no figure. */
  saleCount: number | null;
  rentCount: number | null;
};

/** Confidence from a listing count: 0.30 at 5, +0.02 each extra, max 0.60. */
export function derivedListingConfidence(count: number): number {
  const extra = Math.max(0, Math.floor(count) - MIN_LISTINGS);
  const raw = DERIVED_CONFIDENCE_FLOOR + DERIVED_CONFIDENCE_STEP * extra;
  return Math.round(Math.min(DERIVED_CONFIDENCE_CAP, raw) * 100) / 100;
}

const toBaisa = (omr: number) => Math.round(omr * 1000);
const fromBaisa = (b: number) => Math.round(b) / 1000;

function meanBaisa(values: number[]): number {
  return fromBaisa(values.reduce((a, b) => a + b, 0) / values.length);
}

function medianBaisa(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return fromBaisa(
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
  );
}

function computeGroup(
  scope: AveragesScope,
  propertyType: string,
  listings: AveragesListing[],
): AveragesRow | null {
  const sale: number[] = [];
  const salePerSqm: number[] = [];
  const rent: number[] = [];

  for (const l of listings) {
    if (!Number.isFinite(l.price) || l.price <= 0) continue;
    const baisa = toBaisa(l.price);
    if (baisa <= 0) continue;
    if (l.listingType === "SALE") {
      sale.push(baisa);
      if (l.areaSqm != null && Number.isFinite(l.areaSqm) && l.areaSqm > 0) {
        salePerSqm.push(baisa / l.areaSqm);
      }
    } else {
      rent.push(l.rentPeriod === "ANNUAL" ? baisa / 12 : baisa);
    }
  }

  const counts: number[] = [];
  let avgSalePrice: number | null = null;
  let medianSalePrice: number | null = null;
  let avgPricePerSqm: number | null = null;
  let avgRentMonthly: number | null = null;

  if (sale.length >= MIN_LISTINGS) {
    avgSalePrice = meanBaisa(sale);
    medianSalePrice = medianBaisa(sale);
    counts.push(sale.length);
  }
  if (salePerSqm.length >= MIN_LISTINGS) {
    avgPricePerSqm = meanBaisa(salePerSqm);
    counts.push(salePerSqm.length);
  }
  if (rent.length >= MIN_LISTINGS) {
    avgRentMonthly = meanBaisa(rent);
    counts.push(rent.length);
  }
  if (counts.length === 0) return null;

  const sampleSize = Math.min(...counts);
  return {
    scope,
    propertyType,
    avgSalePrice,
    medianSalePrice,
    avgRentMonthly,
    avgPricePerSqm,
    sampleSize,
    confidence: derivedListingConfidence(sampleSize),
    saleCount: avgSalePrice != null ? sale.length : null,
    rentCount: avgRentMonthly != null ? rent.length : null,
  };
}

/** Average asking prices per place and property type. Deterministic order. */
export function listingAverages(listings: AveragesListing[]): AveragesRow[] {
  const groups = new Map<
    string,
    { scope: AveragesScope; propertyType: string; items: AveragesListing[] }
  >();
  const add = (scope: AveragesScope, l: AveragesListing) => {
    const key = `${scope.kind}:${scope.id}|${l.propertyType}`;
    const g = groups.get(key);
    if (g) g.items.push(l);
    else groups.set(key, { scope, propertyType: l.propertyType, items: [l] });
  };

  for (const l of listings) {
    add({ kind: "neighborhood", id: l.neighborhoodId }, l);
    if (l.cityId) add({ kind: "city", id: l.cityId }, l);
    if (l.governorateId) add({ kind: "governorate", id: l.governorateId }, l);
  }

  const rows: AveragesRow[] = [];
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key)!;
    const row = computeGroup(g.scope, g.propertyType, g.items);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * The plain-words source note stored with a derived figure. `computedOn` is a
 * YYYY-MM-DD string (passed in so this stays pure).
 */
export function listingAveragesSourceNote(
  row: Pick<AveragesRow, "saleCount" | "rentCount">,
  computedOn: string,
): string {
  const parts: string[] = [];
  if (row.saleCount != null) parts.push(`Sale: ${row.saleCount} active listings`);
  if (row.rentCount != null) parts.push(`rent: ${row.rentCount} active listings`);
  const counts = parts.join(", ").replace(/^r/, "R");
  return `${counts}. Asking prices, not sale prices. Computed ${computedOn}.`;
}
