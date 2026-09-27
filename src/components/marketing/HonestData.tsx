import { getLocale, getTranslations } from "next-intl/server";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { formatOMRWhole } from "@/lib/money";

// The differentiator section: every figure carries its source and a
// confidence score. The mock stat card is clearly labeled as illustrative
// and wears an AI_ESTIMATED badge — per house rule 1, an example figure is
// never dressed up as VERIFIED or OFFICIAL_STAT.
export async function HonestData() {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);

  const tight = locale === "ar" ? "" : "tracking-tight";
  const wide = locale === "ar" ? "" : "tracking-wide";

  const legend = [
    { provenance: "VERIFIED", body: t("honestyLegendVerified") },
    { provenance: "OFFICIAL_STAT", body: t("honestyLegendOfficial") },
    { provenance: "USER_SUBMITTED", body: t("honestyLegendUser") },
    { provenance: "AI_ESTIMATED", body: t("honestyLegendAi") },
  ] as const;

  return (
    <section className="bg-stone-900 dark:border-y dark:border-stone-800">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:gap-14">
        <div className="text-start">
          <span className={`text-xs font-semibold text-brand-200 uppercase rtl:text-sm ${wide}`}>
            {t("honestyKicker")}
          </span>
          <h2 className={`mt-2 text-2xl font-bold text-white sm:text-3xl ${tight}`}>
            {t("dataHonestyTitle")}
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-stone-300">
            {t("dataHonestyBody")}
          </p>
          <ul className="mt-8 space-y-4">
            {legend.map((item) => (
              <li key={item.provenance} className="flex items-start gap-3">
                <span className="shrink-0 pt-0.5">
                  <ProvenanceBadge provenance={item.provenance} />
                </span>
                <span className="text-sm leading-relaxed text-stone-300">
                  {item.body}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-stone-200 dark:bg-stone-950 dark:ring-stone-700">
          <p className="text-xs font-medium text-stone-500 rtl:text-sm dark:text-stone-400">
            {t("honestyExampleTag")}
          </p>
          <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">
              {t("honestyExampleMetric")}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-bold text-stone-900 tabular-nums dark:text-stone-100">
                {formatOMRWhole(84_500, locale)}
              </span>
              <ProvenanceBadge provenance="AI_ESTIMATED" confidence={0.62} />
            </div>
            <p className="mt-3 text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
              {t("honestyExampleSource")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
