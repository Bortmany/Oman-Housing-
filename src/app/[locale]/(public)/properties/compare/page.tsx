import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { listingsForCompare, type ListingWithProperty } from "@/lib/db/listings";
import { propertyFinancials } from "@/lib/db/valuations";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { FinancialAnalysisCard } from "@/components/marketplace/FinancialAnalysisCard";
import { Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("properties");
  return { title: t("compare") };
}

async function CompareColumn({
  listing,
  locale,
}: {
  listing: ListingWithProperty;
  locale: string;
}) {
  const [t, te, tc, financials] = await Promise.all([
    getTranslations("properties"),
    getTranslations("enums"),
    getTranslations("common"),
    propertyFinancials(listing.propertyId),
  ]);
  const p = listing.property;
  const image = p.images.find((i) => i.isPrimary) ?? p.images[0];

  return (
    <div className="space-y-4">
      <Card className="!p-0">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${image.storagePath}`}
            alt={localName(locale, p.titleEn, p.titleAr)}
            className="h-44 w-full rounded-t-xl object-cover"
          />
        ) : (
          <div className="grid h-44 w-full place-items-center rounded-t-xl bg-stone-100 text-xs text-stone-400">
            {t("noPhotos")}
          </div>
        )}
        <div className="space-y-2 p-4 text-sm">
          <Link
            href={`/properties/${p.id}`}
            className="font-semibold text-stone-900 hover:text-teal-800"
          >
            {localName(locale, p.titleEn, p.titleAr)}
          </Link>
          <p className="text-xs text-stone-500">
            {localName(locale, p.neighborhood.nameEn, p.neighborhood.nameAr)} ·{" "}
            {te(`propertyType.${p.type}`)} · {te(`ownership.${p.ownership}`)}
          </p>
          <p className="text-lg font-bold text-teal-800">
            {formatOMRWhole(decimalToNumber(listing.price)!, locale)}
            {listing.rentPeriod && (
              <span className="ms-1 text-xs font-medium text-stone-500">
                {te(`rentPeriod.${listing.rentPeriod}`)}
              </span>
            )}
            <span className="ms-2 text-xs font-medium text-stone-500">
              {listing.listingType === "SALE" ? t("sale") : t("rent")}
            </span>
          </p>
          <p className="text-xs text-stone-500">
            {p.bedrooms != null && <>{p.bedrooms} {tc("beds")} · </>}
            {p.bathrooms != null && <>{p.bathrooms} {tc("baths")} · </>}
            {p.areaSqm != null && <>{decimalToNumber(p.areaSqm)} {tc("sqm")}</>}
          </p>
          <ProvenanceBadge provenance={listing.provenance} confidence={listing.confidence} />
        </div>
      </Card>
      <FinancialAnalysisCard financials={financials} />
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const [t, locale, options] = await Promise.all([
    getTranslations("properties"),
    getLocale(),
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { publishedAt: "desc" },
      take: 30,
      include: { property: { select: { titleEn: true, titleAr: true } } },
    }),
  ]);

  const [la, lb] = a && b ? await listingsForCompare(a, b) : [null, null];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900">{t("compare")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("compareHint")}</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        {(["a", "b"] as const).map((name) => (
          <div key={name} className="min-w-64">
            <Label htmlFor={name}>{name === "a" ? t("selectA") : t("selectB")}</Label>
            <Select id={name} name={name} defaultValue={(name === "a" ? a : b) ?? ""}>
              <option value="" disabled>—</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {localName(locale, o.property.titleEn, o.property.titleAr)} —{" "}
                  {formatOMRWhole(decimalToNumber(o.price)!, locale)}
                </option>
              ))}
            </Select>
          </div>
        ))}
        <Button type="submit">{t("compare")}</Button>
      </form>

      {la && lb && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <CompareColumn listing={la} locale={locale} />
          <CompareColumn listing={lb} locale={locale} />
        </div>
      )}
    </div>
  );
}
