import { prisma } from "@/lib/prisma";
import type {
  ListingStatus,
  ListingType,
  OwnershipEligibility,
  Prisma,
  PropertyType,
} from "@prisma/client";

const listingInclude = {
  property: {
    include: {
      neighborhood: { include: { city: true } },
      images: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} satisfies Prisma.ListingInclude;

export type ListingWithProperty = Prisma.ListingGetPayload<{
  include: typeof listingInclude;
}>;

export type SearchFilters = {
  neighborhoodSlug?: string;
  type?: PropertyType;
  listingType?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  ownership?: OwnershipEligibility;
};

/** Public search — ACTIVE listings only, ever. */
export async function searchListings(
  filters: SearchFilters,
): Promise<ListingWithProperty[]> {
  return prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.listingType ? { listingType: filters.listingType } : {}),
      ...(filters.minPrice != null || filters.maxPrice != null
        ? {
            price: {
              ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
              ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
            },
          }
        : {}),
      property: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.ownership ? { ownership: filters.ownership } : {}),
        ...(filters.minBedrooms != null
          ? { bedrooms: { gte: filters.minBedrooms } }
          : {}),
        ...(filters.neighborhoodSlug
          ? { neighborhood: { slug: filters.neighborhoodSlug } }
          : {}),
      },
    },
    include: listingInclude,
    orderBy: { publishedAt: "desc" },
    take: 60,
  });
}

export async function listingById(
  id: string,
): Promise<ListingWithProperty | null> {
  return prisma.listing.findUnique({ where: { id }, include: listingInclude });
}

export async function activeListingsForProperty(propertyId: string) {
  return prisma.listing.findMany({
    where: { propertyId, status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
  });
}

export async function listingsForCompare(a: string, b: string) {
  const [la, lb] = await Promise.all([listingById(a), listingById(b)]);
  // Only ACTIVE listings are comparable publicly.
  return [
    la?.status === "ACTIVE" ? la : null,
    lb?.status === "ACTIVE" ? lb : null,
  ] as const;
}

export async function adminListListings(status?: ListingStatus) {
  return prisma.listing.findMany({
    where: status ? { status } : {},
    include: listingInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

/**
 * Nearest market comp for a property: neighborhood scope first, then the
 * neighborhood's city, then the national (all-null-scope) row. Latest month.
 */
export async function nearestMarketStat(
  neighborhoodId: string,
  propertyType: PropertyType,
) {
  const hoodStat = await prisma.marketStat.findFirst({
    where: { neighborhoodId, propertyType },
    orderBy: { periodStart: "desc" },
  });
  if (hoodStat) return hoodStat;

  const hood = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { cityId: true },
  });
  if (hood) {
    const cityStat = await prisma.marketStat.findFirst({
      where: { cityId: hood.cityId, neighborhoodId: null, propertyType },
      orderBy: { periodStart: "desc" },
    });
    if (cityStat) return cityStat;
  }

  return prisma.marketStat.findFirst({
    where: {
      governorateId: null,
      cityId: null,
      neighborhoodId: null,
      propertyType,
    },
    orderBy: { periodStart: "desc" },
  });
}
