import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PropertyDetailLoading } from "./PropertyDetailLoading";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  activeListingsForProperty,
  agencyContactForProperty,
  ownerContactForProperty,
} from "@/lib/db/listings";
import { publicPropertyWhere } from "@/lib/listings/rules";
import { PhotoGallery } from "@/components/marketplace/PhotoGallery";
import { propertyFinancials } from "@/lib/db/valuations";
import { isFavoritedSet } from "@/lib/db/favorites";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName, isEnglishFallback } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { FinancialAnalysisCard } from "@/components/marketplace/FinancialAnalysisCard";
import { AiAnalystCard } from "@/components/marketplace/AiAnalystCard";
import { FeaturedLabel } from "@/components/marketplace/FeaturedLabel";
import { hasFeaturedListing } from "@/lib/featured";
import { AdSlot } from "@/components/ads/AdSlot";
import { EnquiryCard } from "@/components/marketplace/EnquiryCard";
import { ContactButtons } from "@/components/marketplace/ContactButtons";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { PropertyMap } from "@/components/map/PropertyMap";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { pageMetadata } from "@/lib/seo";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  absoluteUrl,
  buildPropertyShareText,
  isPropertyIndexable,
  pickCoverImage,
} from "@/lib/seoCore";

// Share tags: title, cover photo and (only when a live listing exists) the
// ASKING price. No estimate, yield or fair value ever goes in here. A sample
// record, or a property with no live listing, stays reachable by link but is
// kept out of search results.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: { id, ...publicPropertyWhere },
    include: {
      neighborhood: { include: { city: true } },
      images: { orderBy: { sortOrder: "asc" } },
      listings: {
        where: { status: "ACTIVE" },
        orderBy: { publishedAt: "desc" },
        select: { status: true, listingType: true, price: true, rentPeriod: true, isSample: true },
      },
    },
  });
  if (!property) return {}; // the page itself shows not-found
  const [locale, ts, te] = await Promise.all([
    getLocale(),
    getTranslations("seo"),
    getTranslations("enums"),
  ]);
  const title = localName(locale, property.titleEn, property.titleAr);
  const description = buildPropertyShareText({
    locale,
    templates: {
      sale: ts.raw("propertyDescriptionSale"),
      rent: ts.raw("propertyDescriptionRent"),
      noPrice: ts.raw("propertyDescriptionNoPrice"),
    },
    periodLabels: { MONTHLY: te("rentPeriod.MONTHLY"), ANNUAL: te("rentPeriod.ANNUAL") },
    type: te(`propertyType.${property.type}`),
    area: localName(locale, property.neighborhood.nameEn, property.neighborhood.nameAr),
    city: localName(locale, property.neighborhood.city.nameEn, property.neighborhood.city.nameAr),
    propertyIsSample: property.isSample,
    listings: property.listings.map((l) => ({ ...l, price: decimalToNumber(l.price) ?? 0 })),
  });
  const base = getSiteUrl();
  const cover = pickCoverImage(property.images);
  const image =
    base && cover
      ? {
          url: absoluteUrl(base, `/api/images/${cover.storagePath}`),
          alt: localName(locale, cover.altEn ?? title, cover.altAr),
        }
      : undefined; // no photo: pageMetadata falls back to the default share image
  return pageMetadata({
    path: `/properties/${property.id}`,
    title,
    description,
    image,
    noindex: !isPropertyIndexable(property),
    follow: true,
  });
}

// A wrong or hidden address must answer with a real 404. A route-level
// loading file starts streaming before the page can decide, which makes the
// "not found" page arrive with a 200. So the cheap existence check runs first
// (before anything is sent), and only the heavy body streams behind the skeleton.
export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exists = await prisma.property.findFirst({
    where: { id, ...publicPropertyWhere },
    select: { id: true },
  });
  if (!exists) notFound();
  return (
    <Suspense fallback={<PropertyDetailLoading />}>
      <PropertyDetailBody id={id} />
    </Suspense>
  );
}

async function PropertyDetailBody({ id }: { id: string }) {
  // The public-property rule: a property opens only if it has no listings at
  // all (the admin's reference records) or at least one LIVE listing. Pending,
  // rejected, withdrawn, sold, rented and draft listings are never public, even
  // to someone holding the address - the same not-found page as a wrong id.
  const property = await prisma.property.findFirst({
    where: { id, ...publicPropertyWhere },
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

  const [agency, owner] = await Promise.all([
    agencyContactForProperty(id),
    ownerContactForProperty(id),
  ]);

  const favoritedSet = session
    ? await isFavoritedSet(session.user.id, listings.map((l) => l.id))
    : new Set<string>();
  const title = localName(locale, property.titleEn, property.titleAr);
  // The cover photo leads, then the rest in the owner's order.
  const galleryPhotos = [...property.images]
    .sort((x, y) => Number(y.isPrimary) - Number(x.isPrimary) || x.sortOrder - y.sortOrder)
    .map((img) => ({
      src: `/api/images/${img.storagePath}`,
      alt: localName(locale, img.altEn ?? title, img.altAr),
    }));
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
        {hasFeaturedListing(listings, new Date()) && <FeaturedLabel />}
        {isEnglishFallback(locale, property.titleAr) && (
          <span className="text-xs text-stone-400 dark:text-stone-500">
            ({tc("englishOnly")})
          </span>
        )}
        {property.neighborhood.isITC && (
          <Tooltip label={tm("itcHint")}>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-400/30">
              {tm("itcBadge")}
            </span>
          </Tooltip>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {localName(locale, property.neighborhood.nameEn, property.neighborhood.nameAr)},{" "}
        {localName(locale, property.neighborhood.city.nameEn, property.neighborhood.city.nameAr)}
        {" · "}{te(`ownership.${property.ownership}`)}
      </p>

      {/* Photos: cover big, thumbnail strip, full-screen viewer. */}
      <PhotoGallery photos={galleryPhotos} />

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
                          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                            {" "}{te(`rentPeriod.${l.rentPeriod}`)}
                          </span>
                        )}
                      </span>
                      <span className="ms-2 text-xs text-stone-500 dark:text-stone-400">
                        {l.listingType === "SALE" ? t("sale") : t("rent")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProvenanceBadge provenance={l.provenance} confidence={l.confidence} isSample={l.isSample} />
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
                isSample={property.isSample}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <FinancialAnalysisCard financials={financials} />

          {/* Paid, labelled "Ad", its own card, never part of the figures above. */}
          <AdSlot slot="PROPERTY_BELOW_FINANCIALS" neighborhoodId={property.neighborhoodId} className="my-8" />

          <AiAnalystCard
            propertyId={property.id}
            signedIn={!!session}
            redirectTo={here}
          />

          {agency ? (
            <ContactButtons
              phone={agency.phone}
              agencyName={localName(locale, agency.nameEn, agency.nameAr)}
            />
          ) : (
            owner && <ContactButtons phone={owner.phone} agencyName="" byOwner />
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
