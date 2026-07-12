import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activeListingsForProperty } from "@/lib/db/listings";
import { propertyFinancials } from "@/lib/db/valuations";
import { isFavoritedSet } from "@/lib/db/favorites";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName, isEnglishFallback } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { FinancialAnalysisCard } from "@/components/marketplace/FinancialAnalysisCard";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { PropertyMap } from "@/components/map/PropertyMap";
import { Link } from "@/i18n/navigation";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      neighborhood: { include: { city: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!property) notFound();

  const [t, tm, te, tc, locale, session, listings, financials] =
    await Promise.all([
      getTranslations("properties"),
      getTranslations("market"),
      getTranslations("enums"),
      getTranslations("common"),
      getLocale(),
      auth(),
      activeListingsForProperty(id),
      propertyFinancials(id),
    ]);

  const favoritedSet = session
    ? await isFavoritedSet(session.user.id, listings.map((l) => l.id))
    : new Set<string>();
  const title = localName(locale, property.titleEn, property.titleAr);
  const here = `/properties/${property.id}`;

  const specs: Array<[string, string | number | null]> = [
    [t("filterType"), te(`propertyType.${property.type}`)],
    [tc("beds"), property.bedrooms],
    [tc("baths"), property.bathrooms],
    [tc("sqm"), decimalToNumber(property.areaSqm)],
    [t("yearBuilt"), property.yearBuilt],
    [
      t("furnished"),
      property.furnished == null ? null : property.furnished ? t("furnished") : t("unfurnished"),
    ],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/properties" className="text-sm text-teal-800 hover:underline">
        ‹ {t("backToSearch")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-stone-900">{title}</h1>
        {isEnglishFallback(locale, property.titleAr) && (
          <span className="text-xs text-stone-400">({tc("englishOnly")})</span>
        )}
        {property.neighborhood.isITC && (
          <span
            className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20"
            title={tm("itcHint")}
          >
            {tm("itcBadge")}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {localName(locale, property.neighborhood.nameEn, property.neighborhood.nameAr)},{" "}
        {localName(locale, property.neighborhood.city.nameEn, property.neighborhood.city.nameAr)}
        {" · "}{te(`ownership.${property.ownership}`)}
      </p>

      {/* Photos */}
      {property.images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {property.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={`/api/images/${img.storagePath}`}
              alt={localName(locale, img.altEn ?? title, img.altAr)}
              className="h-44 w-full rounded-xl object-cover ring-1 ring-stone-200"
            />
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Active listings with prices */}
          {listings.length > 0 && (
            <Card>
              <h2 className="text-base font-semibold text-stone-900">
                {t("activeListings")}
              </h2>
              <ul className="mt-3 space-y-3">
                {listings.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2"
                  >
                    <div>
                      <span className="text-lg font-bold text-teal-800">
                        {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                        {l.rentPeriod && (
                          <span className="ms-1 text-xs font-medium text-stone-500">
                            {te(`rentPeriod.${l.rentPeriod}`)}
                          </span>
                        )}
                      </span>
                      <span className="ms-2 text-xs text-stone-500">
                        {l.listingType === "SALE" ? t("sale") : t("rent")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProvenanceBadge provenance={l.provenance} confidence={l.confidence} />
                      <FavoriteButton
                        listingId={l.id}
                        favorited={favoritedSet.has(l.id)}
                        signedIn={!!session}
                        redirectTo={here}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Specs */}
          <Card>
            <h2 className="text-base font-semibold text-stone-900">{t("specs")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {specs
                .filter(([, v]) => v != null)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-stone-500">{label}</dt>
                    <dd className="font-semibold text-stone-900">{value}</dd>
                  </div>
                ))}
            </dl>
            {(property.descriptionEn || property.descriptionAr) && (
              <p className="mt-4 whitespace-pre-line text-sm text-stone-600">
                {localName(
                  locale,
                  property.descriptionEn ?? "",
                  property.descriptionAr,
                )}
              </p>
            )}
            <div className="mt-4">
              <ProvenanceBadge
                provenance={property.provenance}
                confidence={property.confidence}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <FinancialAnalysisCard financials={financials} />

          {property.lat != null && property.lng != null && (
            <Card>
              <h2 className="text-base font-semibold text-stone-900">
                {t("mapTitle")}
              </h2>
              <div className="mt-3">
                <PropertyMap
                  center={{ lat: property.lat, lng: property.lng }}
                  pins={[{ lat: property.lat, lng: property.lng, label: title }]}
                  zoom={14}
                  className="h-64 w-full rounded-xl ring-1 ring-stone-200"
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
