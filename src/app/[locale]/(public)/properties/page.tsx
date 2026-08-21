import { getLocale, getTranslations } from "next-intl/server";
import type {
  ListingType,
  OwnershipEligibility,
  PropertyType,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchListings, type SearchFilters } from "@/lib/db/listings";
import { isFavoritedSet } from "@/lib/db/favorites";
import { findSavedSearchByQuery } from "@/lib/db/saved-searches";
import { normalizeSearchQuery } from "@/lib/savedSearch";
import { localName } from "@/lib/i18nData";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PropertyFilters } from "@/components/marketplace/PropertyFilters";
import { AppliedFilters } from "@/components/marketplace/AppliedFilters";
import { SaveSearchButton } from "@/components/marketplace/SaveSearchButton";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { PropertyMap, type MapPin } from "@/components/map/PropertyMap";
import { Card } from "@/components/ui/Card";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

export async function generateMetadata() {
  const t = await getTranslations("properties");
  return { title: t("title") };
}

const PROPERTY_TYPES = new Set([
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
]);
const OWNERSHIP = new Set(["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"]);

function num(v: string | undefined): number | undefined {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters: SearchFilters = {
    neighborhoodSlug: sp.hood || undefined,
    type: PROPERTY_TYPES.has(sp.type ?? "") ? (sp.type as PropertyType) : undefined,
    listingType:
      sp.listingType === "SALE" || sp.listingType === "RENT"
        ? (sp.listingType as ListingType)
        : undefined,
    minPrice: num(sp.minPrice),
    maxPrice: num(sp.maxPrice),
    minBedrooms: num(sp.beds),
    ownership: OWNERSHIP.has(sp.ownership ?? "")
      ? (sp.ownership as OwnershipEligibility)
      : undefined,
  };

  const [t, locale, session, neighborhoods, listings] = await Promise.all([
    getTranslations("properties"),
    getLocale(),
    auth(),
    prisma.neighborhood.findMany({
      orderBy: { nameEn: "asc" },
      select: { slug: true, nameEn: true, nameAr: true },
    }),
    searchListings(filters),
  ]);

  // Only the filters that survived validation go into the chips, the saved
  // search, and the "remove this one" links — never the raw URL.
  const applied = {
    hood: filters.neighborhoodSlug,
    type: filters.type,
    listingType: filters.listingType,
    minPrice: filters.minPrice?.toString(),
    maxPrice: filters.maxPrice?.toString(),
    beds: filters.minBedrooms?.toString(),
    ownership: filters.ownership,
  };
  const cleanQuery = normalizeSearchQuery(
    new URLSearchParams(
      Object.entries(applied).filter(([, v]) => Boolean(v)) as [string, string][],
    ).toString(),
  );
  const here = cleanQuery ? `/properties?${cleanQuery}` : "/properties";

  const [favoritedSet, savedAlready] = await Promise.all([
    session
      ? isFavoritedSet(session.user.id, listings.map((l) => l.id))
      : new Set<string>(),
    session ? findSavedSearchByQuery(session.user.id, cleanQuery) : null,
  ]);

  // Map pins for the results that have coordinates; no coordinates anywhere
  // means no map at all rather than an empty grey box.
  const pins: MapPin[] = listings
    .filter((l) => l.property.lat != null && l.property.lng != null)
    .map((l) => ({
      lat: l.property.lat as number,
      lng: l.property.lng as number,
      label: localName(locale, l.property.titleEn, l.property.titleAr),
      href: getPathname({
        href: `/properties/${l.property.id}`,
        locale: locale as Locale,
      }),
    }));
  const center =
    pins.length > 0
      ? {
          lat: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
          lng: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
        }
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-stone-300">
            {t("subtitle")}
          </p>
        </div>
        <DirectionalLink
          direction="forward"
          href="/properties/compare"
          className="text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300"
        >
          {t("compare")}
        </DirectionalLink>
      </div>

      <div className="mt-6">
        <PropertyFilters
          neighborhoods={neighborhoods}
          values={{
            hood: sp.hood, type: sp.type, listingType: sp.listingType,
            minPrice: sp.minPrice, maxPrice: sp.maxPrice,
            beds: sp.beds, ownership: sp.ownership,
          }}
        />
      </div>

      <AppliedFilters values={applied} neighborhoods={neighborhoods} />

      <SaveSearchButton
        query={cleanQuery}
        signedIn={!!session}
        alreadySaved={!!savedAlready}
        redirectTo={here}
      />

      {listings.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700 dark:text-stone-200">
            {t("noResults")}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {t("noResultsHint")}
          </p>
        </Card>
      ) : (
        <>
          {center && (
            <div className="mt-8">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {t("mapTitle")}
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {t("mapHint", { count: pins.length })}
              </p>
              <div className="mt-3">
                <PropertyMap
                  center={center}
                  pins={pins}
                  zoom={pins.length === 1 ? 14 : 10}
                  className="h-80 w-full rounded-xl ring-1 ring-stone-200 dark:ring-stone-700"
                />
              </div>
            </div>
          )}

          <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
            {t("resultsCount", { count: listings.length })}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                favorited={favoritedSet.has(l.id)}
                signedIn={!!session}
                redirectTo={here}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
