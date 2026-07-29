import { getLocale, getTranslations } from "next-intl/server";
import type { PropertyType } from "@prisma/client";
import {
  latestStatsByNeighborhood,
  neighborhoodTrends,
} from "@/lib/db/market-stats";
import { decimalToNumber, formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, formatMonth } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { Link } from "@/i18n/navigation";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("title") };
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const propertyType: PropertyType = type === "villa" ? "VILLA" : "APARTMENT";

  const [t, tc, locale, stats] = await Promise.all([
    getTranslations("market"),
    getTranslations("common"),
    getLocale(),
    latestStatsByNeighborhood(type === "villa" ? "VILLA" : "APARTMENT"),
  ]);

  const sorted = [...stats].sort(
    (a, b) =>
      (decimalToNumber(b.avgSalePrice) ?? 0) -
      (decimalToNumber(a.avgSalePrice) ?? 0),
  );

  // Trend chart: the four most expensive areas (colors stay by entity order).
  const top = sorted.slice(0, 4);
  const trendRows = await neighborhoodTrends(
    top.map((s) => s.neighborhoodId!),
    propertyType,
  );
  const byPeriod = new Map<number, TrendPoint>();
  for (const row of trendRows) {
    const key = row.periodStart.getTime();
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { label: formatMonth(locale, row.periodStart) });
    }
    byPeriod.get(key)![row.neighborhoodId!] =
      decimalToNumber(row.avgSalePrice);
  }
  const trendData = [...byPeriod.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v);
  const trendSeries = top.map((s) => ({
    key: s.neighborhoodId!,
    name: localName(locale, s.neighborhood!.nameEn, s.neighborhood!.nameAr),
  }));

  const typeTabs = [
    { value: "apartment", label: t("apartments"), active: propertyType === "APARTMENT" },
    { value: "villa", label: t("villas"), active: propertyType === "VILLA" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            {t("subtitle")}
          </p>
        </div>
        <DirectionalLink
          direction="forward"
          href="/market/compare"
          className="text-sm font-semibold text-teal-800 hover:underline"
        >
          {t("compare")}
        </DirectionalLink>
      </div>

      {/* Property-type filter — one row above the charts */}
      <div className="mt-6 flex gap-2">
        {typeTabs.map((tab) => (
          <Link
            key={tab.value}
            href={{ pathname: "/market", query: { type: tab.value } }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
              tab.active
                ? "bg-teal-800 text-white ring-teal-800"
                : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {stats.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700">{t("noData")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("noDataHint")}</p>
        </Card>
      ) : (
        <>
          {trendData.length > 0 && (
            <Card className="mt-8">
              <h2 className="text-base font-semibold text-stone-900">
                {t("priceTrends")}
              </h2>
              <div className="mt-4">
                <TrendChart data={trendData} series={trendSeries} />
              </div>
            </Card>
          )}

          <h2 className="mt-10 text-lg font-semibold text-stone-900">
            {t("neighborhoods")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((s) => {
              const hood = s.neighborhood!;
              return (
                <Link
                  key={s.id}
                  href={`/market/${hood.slug}`}
                  className="group"
                >
                  <Card className="h-full transition-shadow group-hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-stone-900 group-hover:text-teal-800">
                          {localName(locale, hood.nameEn, hood.nameAr)}
                        </h3>
                        <p className="text-xs text-stone-500">
                          {localName(locale, hood.city.nameEn, hood.city.nameAr)}
                        </p>
                      </div>
                      {hood.isITC && (
                        <span
                          className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 rtl:text-xs"
                          title={t("itcHint")}
                        >
                          {t("itcBadge")}
                        </span>
                      )}
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm">{t("avgSalePrice")}</dt>
                        <dd
                          className={
                            s.avgSalePrice
                              ? "text-lg font-bold text-teal-800"
                              : "font-semibold text-stone-500"
                          }
                        >
                          {s.avgSalePrice
                            ? formatOMRWhole(s.avgSalePrice.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm">{t("avgRentMonthly")}</dt>
                        <dd className="font-semibold text-stone-900">
                          {s.avgRentMonthly
                            ? formatOMRWhole(s.avgRentMonthly.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm">{t("avgPricePerSqm")}</dt>
                        <dd className="font-semibold text-stone-900">
                          {s.avgPricePerSqm
                            ? formatOMRWhole(s.avgPricePerSqm.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm">{t("grossYield")}</dt>
                        <dd className="font-semibold text-stone-900">
                          {s.grossYieldPct
                            ? formatPercent(s.grossYieldPct.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex items-center justify-between">
                      <ProvenanceBadge
                        provenance={s.provenance}
                        confidence={s.confidence}
                      />
                      <span className="text-xs text-stone-400 rtl:text-sm">
                        {formatMonth(locale, s.periodStart)}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
