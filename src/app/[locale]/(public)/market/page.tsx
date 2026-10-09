import { pageMetadata } from "@/lib/seo";
import { getLocale, getTranslations } from "next-intl/server";
import type { PropertyType } from "@prisma/client";
import {
  latestAreaFiguresFor,
  latestStatsByNeighborhood,
  neighborhoodTrends,
} from "@/lib/db/market-stats";
import { decimalToNumber, formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, formatMonth } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { AreaFigureCard } from "@/components/market/AreaFigureCard";
import { Tooltip } from "@/components/ui/Tooltip";
import { SampleCaption } from "@/components/provenance/SampleCaption";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { ChartSampleNote } from "@/components/provenance/ChartSampleNote";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { PriceMap } from "@/components/map/PriceMap";
import { priceMapFor } from "@/lib/db/price-map";
import { Link } from "@/i18n/navigation";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { AdCard } from "@/components/ads/AdCard";
import { loadAd } from "@/lib/ads/serve";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return pageMetadata({ path: "/market", title: t("title") });
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const propertyType: PropertyType = type === "villa" ? "VILLA" : "APARTMENT";

  const [t, tc, ta, tp, locale, stats, areaRows, priceMap] = await Promise.all([
    getTranslations("market"),
    getTranslations("common"),
    getTranslations("areaFigure"),
    getTranslations("priceMap"),
    getLocale(),
    latestStatsByNeighborhood(type === "villa" ? "VILLA" : "APARTMENT"),
    // Official whole-governorate figures; a context section only, so a failed
    // read just leaves it out.
    latestAreaFiguresFor("all").catch(() => []),
    // The map is a nice-to-have on top of the cards: a failed read leaves it out.
    getLocale()
      .then((l) => priceMapFor(propertyType, l))
      .catch(() => null),
  ]);

  // One card per governorate that has an official row for the selected type.
  const governorateCards = areaRows
    .filter((r) => r.cityId == null && r.propertyType === propertyType && r.governorate)
    .sort((a, b) =>
      a.governorate!.nameEn.localeCompare(b.governorate!.nameEn),
    );
  const areaSection =
    governorateCards.length > 0 ? (
      <>
        <h2 className="mt-10 text-lg font-semibold text-stone-900 dark:text-stone-100">
          {ta("indexHeading")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {governorateCards.map((r) => {
            const name = localName(
              locale,
              r.governorate!.nameEn,
              r.governorate!.nameAr,
            );
            return (
              <AreaFigureCard
                key={r.id}
                title={ta("governorateTitle", { name })}
                note={ta("indexNote", {
                  area: ta("governorateName", { name }),
                })}
                rows={[r]}
                locale={locale}
              />
            );
          })}
        </div>
      </>
    ) : null;

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

  // Paid sidebar (labelled "Ad"). null = no campaign = the page is exactly as before.
  const sidebarAd = await loadAd("MARKET_SIDEBAR");

  const typeTabs = [
    { value: "apartment", label: t("apartments"), active: propertyType === "APARTMENT" },
    { value: "villa", label: t("villas"), active: propertyType === "VILLA" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-stone-300">
            {t("subtitle")}
          </p>
        </div>
        <DirectionalLink
          direction="forward"
          href="/market/compare"
          className="text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300"
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
                : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {stats.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700 dark:text-stone-300">{t("noData")}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("noDataHint")}</p>
        </Card>
      ) : (
        <div className={sidebarAd ? "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-8" : undefined}>
          <div className="min-w-0">
          {priceMap && (priceMap.points.length > 0 || priceMap.unplaced > 0) && (
            <Card className="mt-8">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {tp("title")}
              </h2>
              <p className="mt-1 mb-4 max-w-2xl text-sm text-stone-600 dark:text-stone-300">
                {tp("subtitle")}
              </p>
              <PriceMap model={priceMap} />
            </Card>
          )}

          {trendData.length > 0 && (
            <Card className="mt-8">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {t("priceTrends")}
              </h2>
              <div className="mt-4">
                <TrendChart data={trendData} series={trendSeries} />
              </div>
              <ChartSampleNote
                rows={trendRows.filter((r) => r.avgSalePrice != null)}
              />
            </Card>
          )}

          </div>

          {sidebarAd && (
            <div className="mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <AdCard ad={sidebarAd} className="lg:sticky lg:top-24" />
            </div>
          )}

          <div className="min-w-0">
          {areaSection}

          <h2 className="mt-10 text-lg font-semibold text-stone-900 dark:text-stone-100">
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
                        <h3 className="font-semibold text-stone-900 group-hover:text-teal-800 dark:text-stone-100 dark:group-hover:text-teal-300">
                          {localName(locale, hood.nameEn, hood.nameAr)}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {localName(locale, hood.city.nameEn, hood.city.nameAr)}
                        </p>
                      </div>
                      {hood.isITC && (
                        <Tooltip label={t("itcHint")}>
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 rtl:text-xs dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-400/30">
                            {t("itcBadge")}
                          </span>
                        </Tooltip>
                      )}
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("avgSalePrice")}</dt>
                        <dd
                          className={
                            s.avgSalePrice
                              ? "text-lg font-bold text-teal-800 dark:text-teal-300"
                              : "font-semibold text-stone-500 dark:text-stone-400"
                          }
                        >
                          {s.avgSalePrice
                            ? formatOMRWhole(s.avgSalePrice.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("avgRentMonthly")}</dt>
                        <dd className="font-semibold text-stone-900 dark:text-stone-100">
                          {s.avgRentMonthly
                            ? formatOMRWhole(s.avgRentMonthly.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("avgPricePerSqm")}</dt>
                        <dd className="font-semibold text-stone-900 dark:text-stone-100">
                          {s.avgPricePerSqm
                            ? formatOMRWhole(s.avgPricePerSqm.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("grossYield")}</dt>
                        <dd className="font-semibold text-stone-900 dark:text-stone-100">
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
                        isSample={s.isSample}
                        sampleSize={s.sampleSize}
                        focusable={false}
                      />
                      <span className="text-xs text-stone-400 rtl:text-sm dark:text-stone-500">
                        {formatMonth(locale, s.periodStart)}
                      </span>
                    </div>
                    {s.isSample && <SampleCaption className="mt-2" />}
                  </Card>
                </Link>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* No neighbourhood figures yet: the official area cards still show. */}
      {stats.length === 0 && areaSection}
    </div>
  );
}
