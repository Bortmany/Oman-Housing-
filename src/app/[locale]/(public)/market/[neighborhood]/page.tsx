import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  neighborhoodBySlug,
  neighborhoodTrends,
} from "@/lib/db/market-stats";
import { decimalToNumber, formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, isEnglishFallback, formatMonth } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { PropertyMap } from "@/components/map/PropertyMap";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ neighborhood: string }>;
}) {
  const { neighborhood: slug } = await params;
  const hood = await neighborhoodBySlug(slug);
  if (!hood) notFound();

  const [t, tc, te, locale, aptTrend, villaTrend] = await Promise.all([
    getTranslations("market"),
    getTranslations("common"),
    getTranslations("enums"),
    getLocale(),
    neighborhoodTrends([hood.id], "APARTMENT"),
    neighborhoodTrends([hood.id], "VILLA"),
  ]);

  function chartData(
    metric: "avgSalePrice" | "avgRentMonthly",
  ): TrendPoint[] {
    const map = new Map<number, TrendPoint>();
    for (const r of aptTrend) {
      const key = r.periodStart.getTime();
      if (!map.has(key)) map.set(key, { label: formatMonth(locale, r.periodStart) });
      map.get(key)!.apartment = decimalToNumber(r[metric]);
    }
    for (const r of villaTrend) {
      const key = r.periodStart.getTime();
      if (!map.has(key)) map.set(key, { label: formatMonth(locale, r.periodStart) });
      map.get(key)!.villa = decimalToNumber(r[metric]);
    }
    return [...map.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);
  }

  const series = [
    ...(aptTrend.length
      ? [{ key: "apartment", name: te("propertyType.APARTMENT") }]
      : []),
    ...(villaTrend.length
      ? [{ key: "villa", name: te("propertyType.VILLA") }]
      : []),
  ];

  const latest = [
    { label: te("propertyType.APARTMENT"), stat: aptTrend.at(-1) },
    { label: te("propertyType.VILLA"), stat: villaTrend.at(-1) },
  ].filter((x) => x.stat);

  const pins = hood.properties
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      lat: p.lat!,
      lng: p.lng!,
      label: localName(locale, p.titleEn, p.titleAr),
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <DirectionalLink
        direction="back"
        href="/market"
        className="text-sm text-teal-800 hover:underline"
      >
        {t("title")}
      </DirectionalLink>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-stone-900">
          {localName(locale, hood.nameEn, hood.nameAr)}
        </h1>
        {hood.isITC && (
          <span
            className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 rtl:text-sm"
            title={t("itcHint")}
          >
            {t("itcBadge")}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {localName(locale, hood.city.nameEn, hood.city.nameAr)},{" "}
        {localName(
          locale,
          hood.city.governorate.nameEn,
          hood.city.governorate.nameAr,
        )}
      </p>

      {latest.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700">{t("noData")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("noDataHint")}</p>
        </Card>
      ) : (
        <>
          {/* Overview cards, one per property type with data */}
          <h2 className="mt-8 text-lg font-semibold text-stone-900">
            {t("overview")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {latest.map(({ label, stat }) => (
              <Card key={label}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-stone-900">{label}</h3>
                  <ProvenanceBadge
                    provenance={stat!.provenance}
                    confidence={stat!.confidence}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm">{t("avgSalePrice")}</dt>
                    <dd className="text-lg font-bold text-teal-800">
                      {stat!.avgSalePrice
                        ? formatOMRWhole(stat!.avgSalePrice.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm">{t("avgRentMonthly")}</dt>
                    <dd className="font-semibold">
                      {stat!.avgRentMonthly
                        ? formatOMRWhole(stat!.avgRentMonthly.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm">{t("avgPricePerSqm")}</dt>
                    <dd className="font-semibold">
                      {stat!.avgPricePerSqm
                        ? formatOMRWhole(stat!.avgPricePerSqm.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm">{t("grossYield")}</dt>
                    <dd className="font-semibold">
                      {stat!.grossYieldPct
                        ? formatPercent(stat!.grossYieldPct.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-end text-xs text-stone-400 rtl:text-sm">
                  {formatMonth(locale, stat!.periodStart)}
                </p>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <h2 className="text-base font-semibold text-stone-900">
              {t("trend")}
            </h2>
            <div className="mt-4">
              <TrendChart data={chartData("avgSalePrice")} series={series} />
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-base font-semibold text-stone-900">
              {t("rentTrend")}
            </h2>
            <div className="mt-4">
              <TrendChart data={chartData("avgRentMonthly")} series={series} />
            </div>
          </Card>
        </>
      )}

      {pins.length > 0 && hood.lat != null && hood.lng != null && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">
            {t("mapTitle")}
          </h2>
          <div className="mt-4">
            <PropertyMap center={{ lat: hood.lat, lng: hood.lng }} pins={pins} />
          </div>
        </div>
      )}

      {hood.properties.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">
            {t("properties")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {hood.properties.map((p) => (
              <Card key={p.id} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-stone-900">
                    {localName(locale, p.titleEn, p.titleAr)}
                    {isEnglishFallback(locale, p.titleAr) && (
                      <span className="ms-2 text-xs text-stone-400">
                        ({tc("englishOnly")})
                      </span>
                    )}
                  </p>
                  <ProvenanceBadge provenance={p.provenance} confidence={p.confidence} />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {te(`propertyType.${p.type}`)}
                  {p.bedrooms != null && <> · {p.bedrooms} {tc("beds")}</>}
                  {p.bathrooms != null && <> · {p.bathrooms} {tc("baths")}</>}
                  {p.areaSqm != null && (
                    <> · {decimalToNumber(p.areaSqm)} {tc("sqm")}</>
                  )}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {te(`ownership.${p.ownership}`)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
