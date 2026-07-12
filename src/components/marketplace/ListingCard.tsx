import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ListingWithProperty } from "@/lib/db/listings";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { FavoriteButton } from "./FavoriteButton";

export function ListingCard({
  listing,
  favorited,
  signedIn,
  redirectTo,
}: {
  listing: ListingWithProperty;
  favorited?: boolean; // undefined = hide the favorite control
  signedIn?: boolean;
  redirectTo?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("properties");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const p = listing.property;
  const image = p.images.find((i) => i.isPrimary) ?? p.images[0];

  return (
    <Card className="flex h-full flex-col !p-0 text-sm">
      <Link href={`/properties/${p.id}`} className="block">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${image.storagePath}`}
            alt={localName(locale, p.titleEn, p.titleAr)}
            className="h-40 w-full rounded-t-xl object-cover"
          />
        ) : (
          <div className="grid h-40 w-full place-items-center rounded-t-xl bg-stone-100 text-xs text-stone-400">
            {t("noPhotos")}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-lg font-bold text-teal-800">
            {formatOMRWhole(decimalToNumber(listing.price)!, locale)}
            {listing.listingType === "RENT" && listing.rentPeriod && (
              <span className="ms-1 text-xs font-medium text-stone-500">
                {te(`rentPeriod.${listing.rentPeriod}`)}
              </span>
            )}
          </p>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            {listing.listingType === "SALE" ? t("sale") : t("rent")}
          </span>
        </div>

        <Link
          href={`/properties/${p.id}`}
          className="font-medium text-stone-900 hover:text-teal-800"
        >
          {localName(locale, p.titleEn, p.titleAr)}
        </Link>
        <p className="text-xs text-stone-500">
          {localName(locale, p.neighborhood.nameEn, p.neighborhood.nameAr)},{" "}
          {localName(locale, p.neighborhood.city.nameEn, p.neighborhood.city.nameAr)}
          {" · "}{te(`propertyType.${p.type}`)}
          {p.bedrooms != null && <> · {p.bedrooms} {tc("beds")}</>}
          {p.areaSqm != null && <> · {decimalToNumber(p.areaSqm)} {tc("sqm")}</>}
        </p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <ProvenanceBadge
            provenance={listing.provenance}
            confidence={listing.confidence}
          />
          {favorited !== undefined && (
            <FavoriteButton
              listingId={listing.id}
              favorited={favorited}
              signedIn={signedIn ?? false}
              redirectTo={redirectTo ?? "/properties"}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
