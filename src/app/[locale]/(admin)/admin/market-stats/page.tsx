import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, formatMonth } from "@/lib/i18nData";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { deleteMarketStat } from "./actions";

export default async function MarketStatsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; updated?: string; deleted?: string }>;
}) {
  const { saved, updated, deleted } = await searchParams;
  const [t, tm, te, locale, stats] = await Promise.all([
    getTranslations("admin"),
    getTranslations("market"),
    getTranslations("enums"),
    getLocale(),
    prisma.marketStat.findMany({
      orderBy: [{ periodStart: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        governorate: true,
        city: true,
        neighborhood: true,
      },
    }),
  ]);

  function scopeName(s: (typeof stats)[number]): string {
    if (s.neighborhood)
      return localName(locale, s.neighborhood.nameEn, s.neighborhood.nameAr);
    if (s.city) return localName(locale, s.city.nameEn, s.city.nameAr);
    if (s.governorate)
      return localName(locale, s.governorate.nameEn, s.governorate.nameAr);
    return t("wholeCountry");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">{t("marketStats")}</h1>
        <ButtonLink href="/admin/market-stats/new">{t("newStat")}</ButtonLink>
      </div>

      {(saved || deleted) && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {deleted ? t("deleted") : updated ? t("duplicateUpdated") : t("saved")}
        </p>
      )}

      {stats.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-medium text-stone-700">{t("table.empty")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("table.emptyStatsHint")}</p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-start text-xs text-stone-500">
                <th className="px-4 py-3 text-start font-medium">{t("table.area")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.type")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.period")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.price")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.rent")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.yield")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.source")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {scopeName(s)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {s.propertyType
                      ? te(`propertyType.${s.propertyType}`)
                      : tm("allTypes")}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {formatMonth(locale, s.periodStart)}
                  </td>
                  <td className="px-4 py-3">
                    {s.avgSalePrice
                      ? formatOMRWhole(s.avgSalePrice.toString(), locale)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.avgRentMonthly
                      ? formatOMRWhole(s.avgRentMonthly.toString(), locale)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.grossYieldPct
                      ? formatPercent(s.grossYieldPct.toString(), locale)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ProvenanceBadge
                      provenance={s.provenance}
                      confidence={s.confidence}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteMarketStat}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button variant="ghost" type="submit" className="!px-2 !py-1 text-xs">
                        ✕
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
