import { pageMetadata } from "@/lib/seo";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/db/listings";
import { isFavoritedSet } from "@/lib/db/favorites";
import { findSavedSearchByQuery } from "@/lib/db/saved-searches";
import { normalizeSearchQuery } from "@/lib/savedSearch";
import {
  DEFAULT_SEARCH_LIMIT,
  boundsToQuery,
  parseSearchFilters,
} from "@/lib/searchFilters";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { effectiveLocation } from "@/lib/approxLocation";
import { localName } from "@/lib/i18nData";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PropertyFilters } from "@/components/marketplace/PropertyFilters";
import { AppliedFilters } from "@/components/marketplace/AppliedFilters";
import { SaveSearchButton } from "@/components/marketplace/SaveSearchButton";
import { ListingCard } from "@/components/marketplace/ListingCard";
import type { MapPin } from "@/components/map/PropertyMap";
import { SearchResultsMap } from "@/components/map/SearchResultsMap";
import { Card } from "@/components/ui/Card";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

export async function generateMetadata() {
  const t = await getTranslations("properties");
  return pageMetadata({ path: "/properties", title: t("title") });
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseSearchFilters(sp);
  const area = filters.bounds;

  const [t, tm, locale, session, neighborhoods, listings] = await Promise.all([
    getTranslations("properties"),
    getTranslations("searchMap"),
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
    ...boundsToQuery(area),
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
  // A home with no spot of its own is drawn at its neighbourhood's centre and
  // marked approximate (never saved onto the home; see lib/approxLocation.ts).
  const pins: MapPin[] = listings.flatMap((l) => {
    const loc = effectiveLocation(l.property, l.property.neighborhood);
    return loc ? [{ l, loc }] : [];
  })
    .map(({ l, loc }) => ({
      lat: loc.lat,
      lng: loc.lng,
      note: loc.approximate ? tm("approximate") : undefined,
      label: localName(locale, l.property.titleEn, l.property.titleAr),
      price: formatOMRWhole(decimalToNumber(l.price)!, locale),
      href: getPathname({
        href: `/properties/${l.property.id}`,
        locale: locale as Locale,
      }),
    }));
  // Shown when there are pins OR a map area is set (so a visitor whose area
  // came up empty can still move the map). Nothing to show = no map at all.
  const center = area
    ? { lat: (area.n + area.s) / 2, lng: (area.e + area.w) / 2 }
    : pins.length > 0
      ? {
          lat: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
          lng: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
        }
      : null;
  const currentQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(applied)) if (v) currentQuery[k] = v;

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
            // Cleaned values only: a broken box is never carried along.
            ...boundsToQuery(area),
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
      {area && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          {tm("savedIncludesArea")}
        </p>
      )}

      {center && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {t("mapTitle")}
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {t("mapHint", { count: pins.length })}
          </p>
          <div className="mt-3">
            <SearchResultsMap
              pins={pins}
              center={center}
              area={area}
              query={currentQuery}
            />
          </div>
          {area && (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              {tm("noLocationNote")}
            </p>
          )}
          {listings.length >= DEFAULT_SEARCH_LIMIT && (
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {tm("capNote")}
            </p>
          )}
        </div>
      )}

      {listings.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700 dark:text-stone-200">
            {area ? tm("noneInArea") : t("noResults")}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {area ? tm("noneInAreaHint") : t("noResultsHint")}
          </p>
        </Card>
      ) : (
        <>
          <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
            {area
              ? tm("inArea", { count: listings.length })
              : t("resultsCount", { count: listings.length })}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                favorited={favoritedSet.has(l.id)}
                signedIn={!!session}
                redirectTo={here}
                showLocationNote
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
