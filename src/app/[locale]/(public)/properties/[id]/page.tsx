import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  activeListingsForProperty,
  agencyContactForProperty,
} from "@/lib/db/listings";
import { propertyFinancials } from "@/lib/db/valuations";
import { isFavoritedSet } from "@/lib/db/favorites";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName, isEnglishFallback } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { FinancialAnalysisCard } from "@/components/marketplace/FinancialAnalysisCard";
import { AiAnalystCard } from "@/components/marketplace/AiAnalystCard";
import { EnquiryCard } from "@/components/marketplace/EnquiryCard";
import { ContactButtons } from "@/components/marketplace/ContactButtons";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { PropertyMap } from "@/components/map/PropertyMap";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

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

  const agency = await agencyContactForProperty(id);

  const favoritedSet = session
    ? await isFavoritedSet(session.user.id, listings.map((l) => l.id))
    : new Set<string>();
  const title = localName(locale, property.titleEn, property.titleAr);
  // The primary photo leads; everything else becomes a thumbnail.
  const heroImage =
    property.images.find((i) => i.isPrimary) ?? property.images[0] ?? null;
  const otherImages = property.images.filter((i) => i.id !== heroImage?.id);
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
      <DirectionalLink
        direction="back"
        href="/properties"
        className="text-sm text-teal-800 hover:underline dark:text-teal-300"
      >
        {t("backToSearch")}
      </DirectionalLink>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">
          {title}
        </h1>
        {isEnglishFallback(locale, property.titleAr) && (
          <span className="text-xs text-stone-400 dark:text-stone-500">
            ({tc("englishOnly")})
          </span>
        )}
        {property.neighborhood.isITC && (
          <span
            className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-400/30"
            title={tm("itcHint")}
          >
            {tm("itcBadge")}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {localName(locale, property.neighborhood.nameEn, property.neighborhood.nameAr)},{" "}
        {localName(locale, property.neighborhood.city.nameEn, property.neighborhood.city.nameAr)}
        {" · "}{te(`ownership.${property.ownership}`)}
      </p>

      {/* Photos: the main one big, the rest as a thumbnail strip underneath. */}
      {heroImage && (
        <div className="mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/images/${heroImage.storagePath}`}
            alt={localName(locale, heroImage.altEn ?? title, heroImage.altAr)}
            className="h-72 w-full rounded-xl object-cover ring-1 ring-stone-200 sm:h-96 dark:ring-stone-700"
          />
          {otherImages.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {otherImages.map((img) => (
                <li key={img.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/images/${img.storagePath}`}
                    alt={localName(locale, img.altEn ?? title, img.altAr)}
                    className="h-20 w-full rounded-lg object-cover ring-1 ring-stone-200 dark:ring-stone-700"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Active listings with prices */}
          {listings.length > 0 && (
            <Card>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {t("activeListings")}
              </h2>
              <ul className="mt-3 space-y-3">
                {listings.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 dark:bg-stone-800"
                  >
                    <div>
                      <span className="text-lg font-bold text-teal-800 dark:text-teal-300">
                        {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                        {l.rentPeriod && (
                          <span className="ms-1 text-xs font-medium text-stone-500 dark:text-stone-400">
                            {te(`rentPeriod.${l.rentPeriod}`)}
                          </span>
                        )}
                      </span>
                      <span className="ms-2 text-xs text-stone-500 dark:text-stone-400">
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
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t("specs")}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {specs
                .filter(([, v]) => v != null)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
                    <dd className="font-semibold text-stone-900 dark:text-stone-100">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
            {(property.descriptionEn || property.descriptionAr) && (
              <p className="mt-4 whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">
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

          <AiAnalystCard
            propertyId={property.id}
            signedIn={!!session}
            redirectTo={here}
          />

          {agency && (
            <ContactButtons
              phone={agency.phone}
              agencyName={localName(locale, agency.nameEn, agency.nameAr)}
            />
          )}

          <EnquiryCard
            listings={listings.map((l) => ({
              id: l.id,
              label: `${l.listingType === "SALE" ? t("sale") : t("rent")} · ${formatOMRWhole(
                decimalToNumber(l.price)!,
                locale,
              )}${l.rentPeriod ? ` ${te(`rentPeriod.${l.rentPeriod}`)}` : ""}`,
            }))}
            signedIn={!!session}
            defaultName={session?.user.name ?? ""}
            defaultEmail={session?.user.email ?? ""}
            registerHref={`/register?callbackUrl=${encodeURIComponent(here)}`}
          />

          {property.lat != null && property.lng != null && (
            <Card>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {t("mapTitle")}
              </h2>
              <div className="mt-3">
                <PropertyMap
                  center={{ lat: property.lat, lng: property.lng }}
                  pins={[{ lat: property.lat, lng: property.lng, label: title }]}
                  zoom={14}
                  className="h-64 w-full rounded-xl ring-1 ring-stone-200 dark:ring-stone-700"
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
