import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CHART_COLORS } from "@/lib/chartPalette";
import { Sparkline } from "./Sparkline";

// HARDCODED illustrative series — deliberately labeled as samples in the UI
// and never presented as real market stats (so no ProvenanceBadge is due;
// the live, source-labeled figures live on /market). Shapes are varied on
// purpose: up, flat, recovering, gently down.
const SAMPLE_TRENDS = [
  { nameKey: "neighborhoodAlMouj", series: [100, 101, 103, 102, 105, 107, 108, 111] },
  { nameKey: "neighborhoodQurum", series: [100, 100, 99, 101, 100, 102, 101, 102] },
  { nameKey: "neighborhoodMuscatHills", series: [100, 97, 95, 96, 98, 101, 103, 104] },
  { nameKey: "neighborhoodSalalah", series: [100, 99, 98, 98, 97, 96, 97, 96] },
] as const;

export async function TrendsShowcase() {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);

  // Latin digits in both languages, matching the money formatter.
  const deltaFmt = new Intl.NumberFormat(
    locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM",
    { signDisplay: "always", maximumFractionDigits: 1 },
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="text-start">
          <span className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
            {t("trendsKicker")}
          </span>
          <h2 className="mt-2 max-w-lg text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {t("trendsTitle")}
          </h2>
        </div>
        <Link
          href="/market"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
        >
          {t("trendsLink")}
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SAMPLE_TRENDS.map((trend, i) => {
          const first = trend.series[0];
          const last = trend.series[trend.series.length - 1];
          const deltaPct = ((last - first) / first) * 100;
          return (
            <div
              key={trend.nameKey}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-900">
                  {t(trend.nameKey)}
                </h3>
                <span className="text-sm font-semibold text-stone-700 tabular-nums">
                  {deltaFmt.format(deltaPct)}%
                </span>
              </div>
              <div className="mt-3">
                <Sparkline
                  data={[...trend.series]}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                />
              </div>
              <p className="mt-3 text-xs text-stone-400">
                {t("trendsSampleTag")} · {t("trendsPeriod")}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 max-w-2xl text-start text-xs text-stone-500">
        {t("trendsNote")}
      </p>
    </section>
  );
}
