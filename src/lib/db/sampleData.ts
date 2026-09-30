// Pure functions — no I/O, no Prisma client. The ONE rule for sample data,
// used by every public query (market-stats.ts, listings.ts, the AI analyst)
// and by valuations.ts, so the site can never apply it two different ways.
// Tested in sampleData.test.ts (runs in `npm test`).
//
// Sample rows are invented demonstration data written only by the seed
// (`isSample = true`). They are never deleted, only stepped aside:
// - a sample MARKET FIGURE is hidden once a real figure exists for the same
//   place, same property type and same month;
// - a sample LISTING or PROPERTY is hidden from public lists once a real,
//   live (ACTIVE) listing exists in the same neighbourhood and property type;
// - a sample VALUATION loses to a real valuation of the same property;
// - the home page is in "sample-only" mode while no real market figure
//   exists anywhere.
// Admin screens never apply these rules — the owner must see every row.

import type { PropertyType } from "@prisma/client";

// ---------- Market figures ----------

/** The fields that identify one market figure's place + type + month. */
export type StatKeyFields = {
  governorateId?: string | null;
  cityId?: string | null;
  neighborhoodId?: string | null;
  propertyType?: PropertyType | null;
  periodStart: Date | string;
  isSample: boolean;
};

function monthKey(periodStart: Date | string): string {
  // Cached rows come back with ISO strings; fresh rows with Dates.
  return new Date(periodStart).toISOString().slice(0, 7);
}

/** One string per place + property type + month. */
export function marketStatKey(row: StatKeyFields): string {
  return [
    row.governorateId ?? "",
    row.cityId ?? "",
    row.neighborhoodId ?? "",
    row.propertyType ?? "",
    monthKey(row.periodStart),
  ].join("|");
}

/**
 * Drop every sample figure that a real figure supersedes (same place, same
 * type, same month). Order is preserved; real rows are never dropped.
 */
export function dropSupersededSampleStats<T extends StatKeyFields>(
  rows: T[],
): T[] {
  const realKeys = new Set(
    rows.filter((r) => !r.isSample).map((r) => marketStatKey(r)),
  );
  return rows.filter((r) => !r.isSample || !realKeys.has(marketStatKey(r)));
}

/** The newest figure left after hiding (ties on the month go to the real row). */
export function latestVisibleStat<T extends StatKeyFields>(rows: T[]): T | null {
  let best: T | null = null;
  for (const row of dropSupersededSampleStats(rows)) {
    if (!best) {
      best = row;
      continue;
    }
    const a = new Date(row.periodStart).getTime();
    const b = new Date(best.periodStart).getTime();
    if (a > b || (a === b && best.isSample && !row.isSample)) best = row;
  }
  return best;
}

/** The newest visible figure for each neighbourhood, in first-seen order. */
export function latestVisibleStatPerNeighborhood<
  T extends StatKeyFields & { neighborhoodId: string | null },
>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (row.neighborhoodId == null) continue;
    const list = groups.get(row.neighborhoodId) ?? [];
    list.push(row);
    groups.set(row.neighborhoodId, list);
  }
  const out: T[] = [];
  for (const list of groups.values()) {
    const latest = latestVisibleStat(list);
    if (latest) out.push(latest);
  }
  return out;
}

/**
 * True when a figure built from these inputs must be labelled sample:
 * anything worked out from a sample figure is sample too.
 */
export function anySample(
  inputs: Array<{ isSample: boolean } | null | undefined>,
): boolean {
  return inputs.some((i) => i?.isSample === true);
}

// ---------- Valuations ----------

/**
 * Pick the valuation to show for one property. `rows` must already be in
 * preference order (newest first). The first real valuation wins; a sample
 * one is used only when no real valuation exists.
 */
export function preferRealValuation<T extends { isSample: boolean }>(
  rows: T[],
): T | null {
  return rows.find((r) => !r.isSample) ?? rows[0] ?? null;
}

/** A valuation of an invented home is invented, whatever its own flag says. */
export function isSampleValuation(
  valuation: { isSample: boolean },
  property: { isSample: boolean },
): boolean {
  return valuation.isSample || property.isSample;
}

// ---------- Listings & properties ----------

/** One string per neighbourhood + property type. */
export function neighborhoodTypeKey(
  neighborhoodId: string,
  type: PropertyType,
): string {
  return `${neighborhoodId}|${type}`;
}

/** A listing on an invented home is invented, whatever its own flag says. */
export function isSampleListing(listing: {
  isSample: boolean;
  property: { isSample: boolean };
}): boolean {
  return listing.isSample || listing.property.isSample;
}

/**
 * The neighbourhood + type pairs that hold at least one real, live listing,
 * from any set of listings (non-ACTIVE and sample ones are ignored).
 */
export function realActiveListingKeys(
  listings: Array<{
    status: string;
    isSample: boolean;
    property: { isSample: boolean; neighborhoodId: string; type: PropertyType };
  }>,
): Set<string> {
  const keys = new Set<string>();
  for (const l of listings) {
    if (l.status !== "ACTIVE" || isSampleListing(l)) continue;
    keys.add(neighborhoodTypeKey(l.property.neighborhoodId, l.property.type));
  }
  return keys;
}

/** Is this sample property hidden from public lists? */
export function isHiddenSampleProperty(
  property: { isSample: boolean; neighborhoodId: string; type: PropertyType },
  realKeys: Set<string>,
): boolean {
  return (
    property.isSample &&
    realKeys.has(neighborhoodTypeKey(property.neighborhoodId, property.type))
  );
}

/** Is this sample listing hidden from public lists, search and dropdowns? */
export function isHiddenSampleListing(
  listing: {
    isSample: boolean;
    property: { isSample: boolean; neighborhoodId: string; type: PropertyType };
  },
  realKeys: Set<string>,
): boolean {
  return (
    isSampleListing(listing) &&
    realKeys.has(
      neighborhoodTypeKey(listing.property.neighborhoodId, listing.property.type),
    )
  );
}

export function hideSupersededSampleListings<
  T extends {
    isSample: boolean;
    property: { isSample: boolean; neighborhoodId: string; type: PropertyType };
  },
>(rows: T[], realKeys: Set<string>): T[] {
  return rows.filter((r) => !isHiddenSampleListing(r, realKeys));
}

export function hideSupersededSampleProperties<
  T extends { isSample: boolean; neighborhoodId: string; type: PropertyType },
>(rows: T[], realKeys: Set<string>): T[] {
  return rows.filter((r) => !isHiddenSampleProperty(r, realKeys));
}

// ---------- Home page mode ----------

/** The whole site holds only sample data while no real market figure exists. */
export function isSampleOnlySite(realMarketStatCount: number): boolean {
  return realMarketStatCount === 0;
}
