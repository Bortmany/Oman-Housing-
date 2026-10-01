import { prisma } from "@/lib/prisma";
import type {
  ListingStatus,
  ListingType,
  OwnershipEligibility,
  Prisma,
  PropertyType,
} from "@prisma/client";
import {
  hideSupersededSampleListings,
  isSampleListing,
  latestVisibleStat,
  neighborhoodTypeKey,
} from "./sampleData";
import { publicStatWhere } from "../statVisibility";
import { publicPropertyWhere } from "../listings/rules";
import { verifiedPhoneOf } from "../phoneVerify";

// Sample data (seeded demonstration homes and listings) follows the one rule
// in ./sampleData.ts: a sample listing or property is hidden from PUBLIC
// lists, search and dropdowns once a real, live (ACTIVE) listing exists in
// the same neighbourhood and property type. Direct reads (a property page,
// a saved link, the compare columns) still return the row, flagged.
// Every listing returned here carries `isSample` already resolved: a listing
// on a sample home is sample, whatever its own flag says. Admin reads are
// never filtered.

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

/** Resolve the listing's own `isSample` (a listing on a sample home is sample). */
function withSampleFlag<
  T extends { isSample: boolean; property: { isSample: boolean } },
>(listing: T): T {
  return { ...listing, isSample: isSampleListing(listing) };
}

/**
 * The neighbourhood + type pairs holding at least one real, live listing
 * (a real listing on a real home). Optionally narrowed to one neighbourhood.
 */
export async function realActiveListingKeysFor(
  scope: { neighborhoodId?: string } = {},
): Promise<Set<string>> {
  const rows = await prisma.property.findMany({
    where: {
      isSample: false,
      ...(scope.neighborhoodId ? { neighborhoodId: scope.neighborhoodId } : {}),
      listings: { some: { status: "ACTIVE", isSample: false } },
    },
    select: { neighborhoodId: true, type: true },
    distinct: ["neighborhoodId", "type"],
  });
  return new Set(rows.map((r) => neighborhoodTypeKey(r.neighborhoodId, r.type)));
}

/** Prisma filter that leaves out sample listings superseded by `realKeys`. */
function notHiddenSampleWhere(
  realKeys: Set<string>,
): Prisma.ListingWhereInput {
  if (realKeys.size === 0) return {};
  const pairs = [...realKeys].map((k) => {
    const [neighborhoodId, type] = k.split("|");
    return { neighborhoodId, type: type as PropertyType };
  });
  return {
    NOT: {
      AND: [
        { OR: [{ isSample: true }, { property: { isSample: true } }] },
        { property: { OR: pairs } },
      ],
    },
  };
}

export type SearchFilters = {
  neighborhoodSlug?: string;
  type?: PropertyType;
  listingType?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  ownership?: OwnershipEligibility;
};

/**
 * Public search — ACTIVE listings only, ever. Sample listings superseded by a
 * real live listing (same neighbourhood + type) are left out. Each row's
 * `isSample` is resolved (true for a listing on a sample home).
 */
export async function searchListings(
  filters: SearchFilters,
): Promise<ListingWithProperty[]> {
  const realKeys = await realActiveListingKeysFor();
  const rows = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...notHiddenSampleWhere(realKeys),
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
  // The where-clause already did it; the pure rule runs again as a guard.
  return hideSupersededSampleListings(rows, realKeys).map(withSampleFlag);
}

/**
 * Live listings for the compare-listings dropdown, with the same sample
 * hiding rule as search. (Offered for properties/compare/page.tsx.)
 */
export async function compareOptionListings() {
  const realKeys = await realActiveListingKeysFor();
  const rows = await prisma.listing.findMany({
    where: { status: "ACTIVE", ...notHiddenSampleWhere(realKeys) },
    orderBy: { publishedAt: "desc" },
    take: 30,
    include: {
      property: {
        select: {
          titleEn: true,
          titleAr: true,
          isSample: true,
          neighborhoodId: true,
          type: true,
        },
      },
    },
  });
  return hideSupersededSampleListings(rows, realKeys).map(withSampleFlag);
}

/** One listing by id (direct link — never hidden; `isSample` resolved). */
export async function listingById(
  id: string,
): Promise<ListingWithProperty | null> {
  const row = await prisma.listing.findUnique({
    where: { id },
    include: listingInclude,
  });
  return row ? withSampleFlag(row) : null;
}

/**
 * This property's live listings (its own page — never hidden, so saved links
 * keep working). Each row's `isSample` is resolved: true when the listing or
 * its home is sample.
 */
export async function activeListingsForProperty(propertyId: string) {
  const rows = await prisma.listing.findMany({
    where: { propertyId, status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
    include: { property: { select: { isSample: true } } },
  });
  return rows.map(({ property, ...listing }) => ({
    ...listing,
    isSample: listing.isSample || property.isSample,
  }));
}

/**
 * The agency behind a property's live listings, when there is one: used for
 * the direct "Call" / "WhatsApp" buttons on the property page. Only approved
 * agencies, and only their public contact details.
 */
export async function agencyContactForProperty(propertyId: string) {
  const listing = await prisma.listing.findFirst({
    where: {
      propertyId,
      status: "ACTIVE",
      agency: { is: { isApproved: true } },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      agency: { select: { nameEn: true, nameAr: true, phone: true } },
    },
  });
  return listing?.agency ?? null;
}

/**
 * The ONE public-property rule at the database: a property may be shown on any
 * public page only if it has no listings at all (the admin's reference
 * records) or at least one live listing. Pending, rejected, withdrawn, sold,
 * rented and draft listings are never public, even to someone holding the
 * address. (The same rule as a pure function: isPropertyPublic in
 * listings/rules.ts, tested in rules.test.ts.)
 */
export async function isPropertyPublicById(propertyId: string): Promise<boolean> {
  const found = await prisma.property.findFirst({
    where: { id: propertyId, ...publicPropertyWhere },
    select: { id: true },
  });
  return found != null;
}

/**
 * A private owner's contact details for a property's live listing: only when
 * the owner has a VERIFIED phone (and so has ticked "show my number" on the
 * listing form). No agency listing, no number, no verification = null, and the
 * page shows no buttons.
 */
export async function ownerContactForProperty(propertyId: string) {
  const listing = await prisma.listing.findFirst({
    where: { propertyId, status: "ACTIVE", agencyId: null, createdBy: { role: "USER" } },
    orderBy: { publishedAt: "desc" },
    select: { createdBy: { select: { phone: true, phoneVerifiedAt: true } } },
  });
  const phone = verifiedPhoneOf(listing?.createdBy);
  return phone ? { phone } : null;
}

export async function listingsForCompare(a: string, b: string) {
  const [la, lb] = await Promise.all([listingById(a), listingById(b)]);
  // Only ACTIVE listings are comparable publicly. Chosen by id, so a sample
  // listing still opens here (flagged) — the dropdown is where hiding applies.
  return [
    la?.status === "ACTIVE" ? la : null,
    lb?.status === "ACTIVE" ? lb : null,
  ] as const;
}

/** Admin list — never filtered; `isSample` resolved for the badge. */
export async function adminListListings(status?: ListingStatus) {
  const rows = await prisma.listing.findMany({
    where: status ? { status } : {},
    include: listingInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(withSampleFlag);
}

/** Latest visible (sample rule applied) stat for one scope, or null. */
async function latestVisibleStatWhere(where: Prisma.MarketStatWhereInput) {
  // A superseded sample row shares its month with the real row hiding it, so
  // the newest few rows are enough.
  const rows = await prisma.marketStat.findMany({
    where: publicStatWhere(where), // unapproved submissions are never public
    orderBy: { periodStart: "desc" },
    take: 6,
  });
  return latestVisibleStat(rows);
}

/**
 * Nearest market comp for a property: neighborhood scope first, then the
 * neighborhood's city, then the national (all-null-scope) row. Latest month
 * after the sample rule (a sample figure superseded by a real one for the
 * same place+type+month is never returned). The row carries `isSample`.
 */
export async function nearestMarketStat(
  neighborhoodId: string,
  propertyType: PropertyType,
) {
  const hoodStat = await latestVisibleStatWhere({ neighborhoodId, propertyType });
  if (hoodStat) return hoodStat;

  const hood = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { cityId: true },
  });
  if (hood) {
    const cityStat = await latestVisibleStatWhere({
      cityId: hood.cityId,
      neighborhoodId: null,
      propertyType,
    });
    if (cityStat) return cityStat;
  }

  return latestVisibleStatWhere({
    governorateId: null,
    cityId: null,
    neighborhoodId: null,
    propertyType,
  });
}
