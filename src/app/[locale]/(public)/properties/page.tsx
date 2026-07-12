import { getTranslations } from "next-intl/server";
import type {
  ListingType,
  OwnershipEligibility,
  PropertyType,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchListings, type SearchFilters } from "@/lib/db/listings";
import { isFavoritedSet } from "@/lib/db/favorites";
import { PropertyFilters } from "@/components/marketplace/PropertyFilters";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

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

  const [t, session, neighborhoods, listings] = await Promise.all([
    getTranslations("properties"),
    auth(),
    prisma.neighborhood.findMany({
      orderBy: { nameEn: "asc" },
      select: { slug: true, nameEn: true, nameAr: true },
    }),
    searchListings(filters),
  ]);

  const favoritedSet = session
    ? await isFavoritedSet(session.user.id, listings.map((l) => l.id))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">{t("subtitle")}</p>
        </div>
        <Link
          href="/properties/compare"
          className="text-sm font-semibold text-teal-800 hover:underline"
        >
          {t("compare")} ←
        </Link>
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

      {listings.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700">{t("noResults")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("noResultsHint")}</p>
        </Card>
      ) : (
        <>
          <p className="mt-6 text-sm text-stone-500">
            {t("resultsCount", { count: listings.length })}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                favorited={favoritedSet.has(l.id)}
                signedIn={!!session}
                redirectTo="/properties"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
