import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  latestStatsByNeighborhood,
  neighborhoodTrends,
} from "@/lib/db/market-stats";
import { decimalToNumber } from "@/lib/money";
import { formatMonth, localName } from "@/lib/i18nData";
import { summarizeTrend } from "@/lib/trendSummary";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { Sparkline } from "./Sparkline";

// How many neighbourhood cards the home page shows.
const CARD_COUNT = 4;

// Real market figures only: the same stored apartment sale prices the market
// dashboard uses, for the four priciest neighbourhoods. Each card shows the
// change over the last 12 months with the badge of the weakest figure behind
// it (src/lib/trendSummary.ts). No data = no section — nothing is invented.
export async function TrendsShowcase() {
  const [t, locale, latest] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    latestStatsByNeighborhood("APARTMENT"),
  ]);

  const top = latest
    .filter((s) => s.neighborhoodId && s.neighborhood)
    .sort(
      (a, b) =>
        (decimalToNumber(b.avgSalePrice) ?? 0) -
        (decimalToNumber(a.avgSalePrice) ?? 0),
    )
    .slice(0, CARD_COUNT);
  if (top.length === 0) return null;

  const rows = await neighborhoodTrends(
    top.map((s) => s.neighborhoodId!),
    "APARTMENT",
    13,
  );

  const cards = top
    .map((s) => ({
      id: s.neighborhoodId!,
      slug: s.neighborhood!.slug,
      name: localName(locale, s.neighborhood!.nameEn, s.neighborhood!.nameAr),
      summary: summarizeTrend(
        rows
          .filter((r) => r.neighborhoodId === s.neighborhoodId)
          .map((r) => ({
            periodStart: r.periodStart,
            value: decimalToNumber(r.avgSalePrice),
            provenance: r.provenance,
            confidence: r.confidence,
          })),
      ),
    }))
    .filter((c) => c.summary !== null);
  if (cards.length === 0) return null;

  // Latin digits in both languages, matching the money formatter.
  const tight = locale === "ar" ? "" : "tracking-tight";
  const wide = locale === "ar" ? "" : "tracking-wide";

  const deltaFmt = new Intl.NumberFormat(
    locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM",
    { signDisplay: "always", maximumFractionDigits: 1 },
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="text-start">
          <span className={`text-xs font-semibold text-brand-700 uppercase rtl:text-sm dark:text-brand-200 ${wide}`}>
            {t("trendsKicker")}
          </span>
          <h2 className={`mt-2 max-w-lg text-2xl font-bold text-stone-900 sm:text-3xl dark:text-stone-100 ${tight}`}>
            {t("trendsTitle")}
          </h2>
        </div>
        <Link
          href="/market"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-950"
        >
          {t("trendsLink")}
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => {
          const s = card.summary!;
          return (
            <Link
              key={card.id}
              href={`/market/${card.slug}`}
              className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition-shadow hover:shadow-md dark:bg-stone-900 dark:ring-stone-800"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {card.name}
                </h3>
                <span
                  className="text-sm font-semibold text-stone-700 tabular-nums dark:text-stone-300"
                  dir="ltr"
                >
                  {deltaFmt.format(s.changePct)}%
                </span>
              </div>
              <div className="mt-3">
                <Sparkline data={s.series} colorIndex={i} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <ProvenanceBadge
                  provenance={s.provenance}
                  confidence={s.confidence}
                />
                <span className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
                  {formatMonth(locale, s.from)} – {formatMonth(locale, s.to)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-4 max-w-2xl text-start text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
        {t("trendsNote")}
      </p>
    </section>
  );
}
