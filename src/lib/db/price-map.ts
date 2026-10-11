import { unstable_cache } from "next/cache";
import type { PropertyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MARKET_DATA_CACHE_TAG, latestStatsByNeighborhood } from "./market-stats";
import { localName } from "@/lib/i18nData";
import { buildPriceMap, type PriceMapInput, type PriceMapModel } from "@/lib/priceMap";

// Every neighbourhood with its name and position (cached 5 min, refreshed by
// the same tag an admin save clears). Merged in code with the latest public
// figure per neighbourhood, which is already sample-aware and visibility-safe
// (publicStatWhere + the sample-hiding rule in latestStatsByNeighborhood).
const cachedNeighborhoods = unstable_cache(
  async () =>
    prisma.neighborhood.findMany({
      select: { id: true, slug: true, nameEn: true, nameAr: true, lat: true, lng: true },
      orderBy: { slug: "asc" },
    }),
  ["price-map-neighborhoods-v1"],
  { revalidate: 300, tags: [MARKET_DATA_CACHE_TAG] },
);

/** The price-per-sqm map model for one property type and locale. */
export async function priceMapFor(
  propertyType: PropertyType,
  locale: string,
): Promise<PriceMapModel> {
  const [hoods, stats] = await Promise.all([
    cachedNeighborhoods(),
    latestStatsByNeighborhood(propertyType),
  ]);
  const byHood = new Map(stats.map((s) => [s.neighborhoodId, s]));

  const rows: PriceMapInput[] = hoods.map((h) => {
    const s = byHood.get(h.id);
    // A figure counts only if the row has a price per sqm; the cache hands
    // Decimals back as strings, so convert at the boundary.
    const price = s?.avgPricePerSqm != null ? Number(s.avgPricePerSqm.toString()) : null;
    const hasPrice = price != null && Number.isFinite(price);
    return {
      slug: h.slug,
      name: localName(locale, h.nameEn, h.nameAr),
      lat: h.lat,
      lng: h.lng,
      price: hasPrice ? price : null,
      sampleSize: hasPrice ? (s?.sampleSize ?? null) : null,
      periodStart: hasPrice && s ? s.periodStart : null,
      provenance: hasPrice && s ? s.provenance : null,
      confidence: s?.confidence ?? 0,
      isSample: hasPrice && s ? s.isSample : false,
    };
  });
  return buildPriceMap(rows);
}
