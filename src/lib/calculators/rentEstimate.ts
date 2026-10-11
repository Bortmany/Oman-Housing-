// Pure functions — no UI, no I/O. Amounts in OMR.
// How a listing's expected rent and the rent behind its yield are worked out.
// Tested in calculators.test.ts (runs in `npm test`).

/** Derived figures never claim more confidence than this (house rule 1). */
export const DERIVED_CONFIDENCE_CAP = 0.5;

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

/**
 * The area's monthly rent per square metre, from the three averages already
 * stored for that area, type and month:
 *   average rent x average price per sqm / average sale price
 * (the average rent divided by the average unit size the stats imply).
 * Null when any of the three is missing or not above zero.
 */
export function areaRentPerSqm(stats: {
  avgRentMonthly: number | null;
  avgPricePerSqm: number | null;
  avgSalePrice: number | null;
}): number | null {
  const { avgRentMonthly, avgPricePerSqm, avgSalePrice } = stats;
  if (!positive(avgRentMonthly) || !positive(avgPricePerSqm) || !positive(avgSalePrice)) {
    return null;
  }
  return (avgRentMonthly * avgPricePerSqm) / avgSalePrice;
}

/** A property's expected monthly rent: its own floor area x the area's rent per sqm. */
export function expectedRentForArea(
  floorAreaSqm: number | null,
  rentPerSqm: number | null,
): number | null {
  if (!positive(floorAreaSqm) || !positive(rentPerSqm)) return null;
  return floorAreaSqm * rentPerSqm;
}

/** A listed rent per month: a yearly rent is divided by 12. */
export function monthlyListedRent(
  price: number,
  rentPeriod: "MONTHLY" | "ANNUAL" | null,
): number {
  return rentPeriod === "ANNUAL" ? price / 12 : price;
}

export type YieldRentBasis = "ASKING" | "ESTIMATE" | "NONE";

/**
 * The rent a yield is worked out from: the property's own advertised rent if
 * it has one, else its per-property estimate, else none — and which it was.
 */
export function chooseYieldRent(input: {
  askingMonthly: number | null;
  estimateMonthly: number | null;
}): { basis: YieldRentBasis; monthlyRent: number | null } {
  if (positive(input.askingMonthly)) {
    return { basis: "ASKING", monthlyRent: input.askingMonthly };
  }
  if (positive(input.estimateMonthly)) {
    return { basis: "ESTIMATE", monthlyRent: input.estimateMonthly };
  }
  return { basis: "NONE", monthlyRent: null };
}

/** Confidence of a figure worked out from these inputs: the weakest, capped. */
export function derivedConfidence(...inputs: number[]): number {
  const weakest = inputs.length ? Math.min(...inputs) : 0;
  return Math.max(0, Math.min(weakest, DERIVED_CONFIDENCE_CAP));
}
