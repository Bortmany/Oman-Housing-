import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  latestAreaFiguresFor,
  neighborhoodBySlug,
  neighborhoodTrends,
} from "@/lib/db/market-stats";
import { decimalToNumber, formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, isEnglishFallback, formatMonth } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { AreaFigureCard } from "@/components/market/AreaFigureCard";
import { OfficialSourceLink } from "@/components/market/OfficialSourceLink";
import { Tooltip } from "@/components/ui/Tooltip";
import { SampleCaption } from "@/components/provenance/SampleCaption";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { ChartSampleNote } from "@/components/provenance/ChartSampleNote";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { PropertyMap } from "@/components/map/PropertyMap";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { Link } from "@/i18n/navigation";
import { searchListings, type ListingWithProperty } from "@/lib/db/listings";
import { pageMetadata } from "@/lib/seo";
import { shortDescription } from "@/lib/seoCore";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ neighborhood: string }>;
}) {
  const { neighborhood: slug } = await params;
  const hood = await neighborhoodBySlug(slug);
  if (!hood) return {}; // the page itself shows not-found
  const [locale, ts] = await Promise.all([getLocale(), getTranslations("seo")]);
  const name = localName(locale, hood.nameEn, hood.nameAr);
  const own = shortDescription(localName(locale, hood.descriptionEn ?? "", hood.descriptionAr));
  return pageMetadata({
    path: `/market/${encodeURIComponent(slug)}`,
    title: name,
    description:
      own ||
      ts("neighborhoodDescription", {
        area: name,
        city: localName(locale, hood.city.nameEn, hood.city.nameAr),
      }),
  });
}

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ neighborhood: string }>;
}) {
  const { neighborhood: slug } = await params;
  const hood = await neighborhoodBySlug(slug);
  if (!hood) notFound();

  const [t, tc, te, tp, ta, locale, aptTrend, villaTrend, hoodListings, areaRows] =
    await Promise.all([
      getTranslations("market"),
      getTranslations("common"),
      getTranslations("enums"),
      getTranslations("properties"),
      getTranslations("areaFigure"),
      getLocale(),
      neighborhoodTrends([hood.id], "APARTMENT"),
      neighborhoodTrends([hood.id], "VILLA"),
      // Live listings here (sample-aware, the same query as search) — priced
      // rows for "Recorded properties".
      searchListings({ neighborhoodSlug: slug }),
      // Official whole-area figures for this place's city and governorate.
      // A context card only: if this read fails the card is simply absent.
      latestAreaFiguresFor([hood.city.governorateId], [hood.cityId]).catch(
        () => [],
      ),
    ]);

  // Labelled area-level card(s): city first (closest to the neighbourhood),
  // then governorate. Never merged into the neighbourhood's own figures.
  const hoodName = localName(locale, hood.nameEn, hood.nameAr);
  const cityName = localName(locale, hood.city.nameEn, hood.city.nameAr);
  const govName = localName(
    locale,
    hood.city.governorate.nameEn,
    hood.city.governorate.nameAr,
  );
  const cityAreaRows = areaRows.filter((r) => r.cityId === hood.cityId);
  const govAreaRows = areaRows.filter(
    (r) => r.cityId == null && r.governorateId === hood.city.governorateId,
  );
  const areaSection =
    cityAreaRows.length + govAreaRows.length > 0 ? (
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AreaFigureCard
          title={ta("cityTitle", { name: cityName })}
          note={ta("notThisArea", { area: cityName, neighborhood: hoodName })}
          rows={cityAreaRows}
          locale={locale}
        />
        <AreaFigureCard
          title={ta("governorateTitle", { name: govName })}
          note={ta("notThisArea", {
            area: ta("governorateName", { name: govName }),
            neighborhood: hoodName,
          })}
          rows={govAreaRows}
          locale={locale}
        />
      </div>
    ) : null;

  const listingsByProperty = new Map<string, ListingWithProperty[]>();
  for (const l of hoodListings) {
    const list = listingsByProperty.get(l.propertyId) ?? [];
    list.push(l);
    listingsByProperty.set(l.propertyId, list);
  }

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

  // The rows a chart actually plots (a month with no figure draws no point).
  function plottedRows(metric: "avgSalePrice" | "avgRentMonthly") {
    return [...aptTrend, ...villaTrend].filter((r) => r[metric] != null);
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
        className="text-sm text-teal-800 hover:underline dark:text-teal-300"
      >
        {t("title")}
      </DirectionalLink>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">
          {localName(locale, hood.nameEn, hood.nameAr)}
        </h1>
        {hood.isITC && (
          <Tooltip label={t("itcHint")}>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 rtl:text-sm dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-400/30">
              {t("itcBadge")}
            </span>
          </Tooltip>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {localName(locale, hood.city.nameEn, hood.city.nameAr)},{" "}
        {localName(
          locale,
          hood.city.governorate.nameEn,
          hood.city.governorate.nameAr,
        )}
      </p>

      {latest.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700 dark:text-stone-300">{t("noData")}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("noDataHint")}</p>
        </Card>
      ) : (
        <>
          {/* Overview cards, one per property type with data */}
          <h2 className="mt-8 text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t("overview")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {latest.map(({ label, stat }) => (
              <Card key={label}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100">{label}</h3>
                  {stat!.isSample ? (
                    <ProvenanceBadge isSample />
                  ) : (
                    <ProvenanceBadge
                      provenance={stat!.provenance}
                      confidence={stat!.confidence}
                      sampleSize={stat!.sampleSize}
                    />
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("avgSalePrice")}</dt>
                    <dd
                      className={
                        stat!.avgSalePrice
                          ? "text-lg font-bold text-teal-800 dark:text-teal-300"
                          : "font-semibold text-stone-500 dark:text-stone-400"
                      }
                    >
                      {stat!.avgSalePrice
                        ? formatOMRWhole(stat!.avgSalePrice.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("avgRentMonthly")}</dt>
                    <dd className="font-semibold">
                      {stat!.avgRentMonthly
                        ? formatOMRWhole(stat!.avgRentMonthly.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("avgPricePerSqm")}</dt>
                    <dd className="font-semibold">
                      {stat!.avgPricePerSqm
                        ? formatOMRWhole(stat!.avgPricePerSqm.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">{t("grossYield")}</dt>
                    <dd className="font-semibold">
                      {stat!.grossYieldPct
                        ? formatPercent(stat!.grossYieldPct.toString(), locale)
                        : tc("none")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <OfficialSourceLink
                    provenance={stat!.provenance}
                    sourceUrl={stat!.isSample ? null : stat!.sourceUrl}
                  />
                  <p className="ms-auto text-xs text-stone-400 rtl:text-sm dark:text-stone-500">
                    {formatMonth(locale, stat!.periodStart)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-start text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
            {t("areaAverageNote")}
          </p>

          {areaSection}

          <Card className="mt-6">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t("trend")}
            </h2>
            <div className="mt-4">
              <TrendChart data={chartData("avgSalePrice")} series={series} />
            </div>
            <ChartSampleNote rows={plottedRows("avgSalePrice")} />
          </Card>

          <Card className="mt-6">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t("rentTrend")}
            </h2>
            <div className="mt-4">
              <TrendChart data={chartData("avgRentMonthly")} series={series} />
            </div>
            <ChartSampleNote rows={plottedRows("avgRentMonthly")} />
          </Card>
        </>
      )}

      {/* With no neighbourhood figures the official area card still shows
          (otherwise imported official data would be invisible). */}
      {latest.length === 0 && areaSection}

      {pins.length > 0 && hood.lat != null && hood.lng != null && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t("mapTitle")}
          </h2>
          <div className="mt-4">
            <PropertyMap center={{ lat: hood.lat, lng: hood.lng }} pins={pins} />
          </div>
        </div>
      )}

      {hood.properties.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t("properties")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hood.properties.map((p) => {
              const live = listingsByProperty.get(p.id) ?? [];
              // Only a home with a live (public) listing links to its page;
              // any other recorded home — including one still awaiting
              // review — is shown as a plain card with no link.
              const linked = live.length > 0;
              const card = (
                <Card className="h-full text-sm transition group-hover:ring-teal-600/40 group-active:ring-teal-600/60">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-stone-900 group-hover:text-teal-800 dark:text-stone-100 dark:group-hover:text-teal-300">
                      {localName(locale, p.titleEn, p.titleAr)}
                      {isEnglishFallback(locale, p.titleAr) && (
                        <span className="ms-2 text-xs text-stone-400 dark:text-stone-500">
                          ({tc("englishOnly")})
                        </span>
                      )}
                    </p>
                    {p.isSample ? (
                      <ProvenanceBadge isSample focusable={!linked} />
                    ) : (
                      <ProvenanceBadge provenance={p.provenance} confidence={p.confidence} />
                    )}
                  </div>
                  {live.length > 0 ? (
                    live.map((l, liveIndex) => (
                      <div
                        key={l.id}
                        className="mt-2 flex flex-wrap items-center justify-between gap-2"
                      >
                        <p className="text-lg font-bold text-teal-800 dark:text-teal-300">
                          {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                          {l.listingType === "RENT" && l.rentPeriod && (
                            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                              {" "}{te(`rentPeriod.${l.rentPeriod}`)}
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                            {l.listingType === "SALE" ? tp("sale") : tp("rent")}
                          </span>
                          {/* One sample badge per card: the home's own badge already says so,
                              and only the first sample listing adds one when the home is real. */}
                          {l.isSample ? (
                            !p.isSample && liveIndex === 0 ? (
                              <ProvenanceBadge isSample focusable={!linked} />
                            ) : null
                          ) : (
                            <ProvenanceBadge provenance={l.provenance} confidence={l.confidence} />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                      {t("recordedNoListing")}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    {te(`propertyType.${p.type}`)}
                    {p.bedrooms != null && <> · {tc("bedsCount", { count: p.bedrooms, n: String(p.bedrooms) })}</>}
                    {p.bathrooms != null && <> · {p.bathrooms} {tc("baths")}</>}
                    {p.areaSqm != null && (
                      <> · {decimalToNumber(p.areaSqm)} {tc("sqm")}</>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {te(`ownership.${p.ownership}`)}
                  </p>
                  {/* Linked cards cannot hold a focusable hint, so say it in plain view. */}
                  {linked && (p.isSample || live.some((l) => l.isSample)) && (
                    <SampleCaption className="mt-2" />
                  )}
                </Card>
              );
              return linked ? (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}`}
                  className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                >
                  {card}
                </Link>
              ) : (
                <div key={p.id}>{card}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
