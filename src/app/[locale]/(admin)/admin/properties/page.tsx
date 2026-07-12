import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

export default async function PropertiesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const [t, tc, te, locale, properties] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getTranslations("enums"),
    getLocale(),
    prisma.property.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        neighborhood: true,
        images: { where: { isPrimary: true }, take: 1 },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">{t("properties")}</h1>
        <ButtonLink href="/admin/properties/new">{t("newProperty")}</ButtonLink>
      </div>

      {deleted && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {t("deleted")}
        </p>
      )}

      {properties.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-medium text-stone-700">{t("table.empty")}</p>
          <p className="mt-1 text-sm text-stone-500">
            {t("table.emptyPropertiesHint")}
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link key={p.id} href={`/admin/properties/${p.id}`} className="group">
              <Card className="h-full text-sm transition-shadow group-hover:shadow-md">
                {p.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/images/${p.images[0].storagePath}`}
                    alt={p.titleEn}
                    className="mb-3 h-36 w-full rounded-lg object-cover"
                  />
                )}
                <p className="font-medium text-stone-900 group-hover:text-teal-800">
                  {localName(locale, p.titleEn, p.titleAr)}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {localName(locale, p.neighborhood.nameEn, p.neighborhood.nameAr)}{" "}
                  · {te(`propertyType.${p.type}`)}
                  {p.bedrooms != null && <> · {p.bedrooms} {tc("beds")}</>}
                  {p.areaSqm != null && (
                    <> · {decimalToNumber(p.areaSqm)} {tc("sqm")}</>
                  )}
                </p>
                <div className="mt-3">
                  <ProvenanceBadge provenance={p.provenance} confidence={p.confidence} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
