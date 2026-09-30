// The database half of "averages from live listings" (Align Step 3, Build C).
// Called by the daily job route and by the admin "Recompute now" button.
//
// Reads ACTIVE listings on real homes (neither the listing nor its home is
// seeded sample data — invented demo prices must never become an "average"),
// hands them to the pure listingAverages() function, and saves every row
// through upsertMarketStat (house rule 6) as LISTING_DERIVED with
// onConflict "replace-derived-only": it can replace an earlier average or an
// invented sample figure, and never an official, verified or user-submitted
// one. Only listing price, type, rent period, area and place are read — no
// contact or buyer details.
//
// Cache refresh is NOT done here: updateTag only works inside server actions
// and revalidateTag is the route's tool, so each caller refreshes the public
// pages itself after this returns (see cacheRefresh.test.ts).

import { prisma } from "./prisma";
import { upsertMarketStat, type StatScope } from "./db/market-stats";
import {
  listingAverages,
  listingAveragesSourceNote,
  type AveragesListing,
  type AveragesScope,
} from "./calculators/listingAverages";
import type { PropertyType } from "@prisma/client";

export type ListingAveragesResult = {
  /** Averages saved (new or updated). */
  written: number;
  /** Averages NOT saved because a non-derived figure already exists. */
  skippedOfficial: number;
  /** Averages from earlier this month removed: fewer than 5 listings now. */
  deleted: number;
};

/** First day of the current calendar month, UTC. */
export function currentMonthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const scopeKey = (s: AveragesScope, propertyType: string | null) =>
  `${s.kind}:${s.id}|${propertyType ?? ""}`;

export async function runListingAveragesJob(
  now: Date = new Date(),
): Promise<ListingAveragesResult> {
  const periodStart = currentMonthStartUtc(now);
  const computedOn = now.toISOString().slice(0, 10);

  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", isSample: false, property: { isSample: false } },
    select: {
      listingType: true,
      price: true,
      rentPeriod: true,
      property: {
        select: {
          type: true,
          areaSqm: true,
          neighborhoodId: true,
          neighborhood: {
            select: { cityId: true, city: { select: { governorateId: true } } },
          },
        },
      },
    },
  });

  const input: AveragesListing[] = listings.map((l) => ({
    listingType: l.listingType,
    price: Number(l.price.toString()),
    rentPeriod: l.rentPeriod,
    areaSqm: l.property.areaSqm == null ? null : Number(l.property.areaSqm.toString()),
    propertyType: l.property.type,
    neighborhoodId: l.property.neighborhoodId,
    cityId: l.property.neighborhood.cityId,
    governorateId: l.property.neighborhood.city.governorateId,
  }));

  const rows = listingAverages(input);
  const result: ListingAveragesResult = { written: 0, skippedOfficial: 0, deleted: 0 };

  for (const row of rows) {
    const { skipped } = await upsertMarketStat({
      scope: row.scope as StatScope,
      propertyType: row.propertyType as PropertyType,
      periodStart,
      metrics: {
        avgSalePrice: row.avgSalePrice,
        medianSalePrice: row.medianSalePrice,
        avgRentMonthly: row.avgRentMonthly,
        avgPricePerSqm: row.avgPricePerSqm,
        sampleSize: row.sampleSize,
      },
      provenance: "LISTING_DERIVED",
      confidence: row.confidence,
      sourceNote: listingAveragesSourceNote(row, computedOn),
      sourceUrl: null,
      onConflict: "replace-derived-only",
    });
    if (skipped) result.skippedOfficial++;
    else result.written++;
  }

  // A derived average from earlier this month whose place no longer has
  // enough listings is a made-up number: remove it. Earlier months stay as
  // history; rows of any other provenance are never touched.
  const liveKeys = new Set(rows.map((r) => scopeKey(r.scope, r.propertyType)));
  const existing = await prisma.marketStat.findMany({
    where: { provenance: "LISTING_DERIVED", periodStart },
    select: {
      id: true,
      governorateId: true,
      cityId: true,
      neighborhoodId: true,
      propertyType: true,
    },
  });
  const staleIds = existing
    .filter((e) => {
      const scope: AveragesScope | null = e.neighborhoodId
        ? { kind: "neighborhood", id: e.neighborhoodId }
        : e.cityId
          ? { kind: "city", id: e.cityId }
          : e.governorateId
            ? { kind: "governorate", id: e.governorateId }
            : null;
      return scope == null || !liveKeys.has(scopeKey(scope, e.propertyType));
    })
    .map((e) => e.id);
  if (staleIds.length > 0) {
    const { count } = await prisma.marketStat.deleteMany({
      where: { id: { in: staleIds }, provenance: "LISTING_DERIVED", periodStart },
    });
    result.deleted = count;
  }

  return result;
}
