import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { MortgageTeaser } from "./MortgageTeaser";
import { Reveal } from "./Reveal";

// Home-page hero: headline and the property search on one side, the live
// mortgage slider on the other. The search is passed in as `search` so this
// component stays about layout.
export async function Hero({ search }: { search: ReactNode }) {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);
  // tracking-tight suits large Latin headings only — tightening breaks
  // Arabic's connected letterforms, so the Arabic heading keeps normal spacing.
  const tight = locale === "ar" ? "" : "tracking-tight";

  return (
    <section className="border-b border-stone-200 bg-linear-to-b from-brand-50/70 via-white to-stone-50 dark:border-stone-800 dark:from-brand-950/60 dark:via-stone-950 dark:to-stone-950">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-14">
        <div className="text-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-900 rtl:text-sm dark:bg-brand-900 dark:text-brand-100">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand-700 dark:bg-brand-200"
            />
            {t("heroBadge")}
          </span>
          <h1
            className={`mt-5 max-w-xl text-4xl font-bold text-stone-900 sm:text-5xl lg:text-6xl dark:text-stone-100 ${tight}`}
          >
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-300">
            {t("heroSubtitle")}
          </p>

          <div className="mt-8 max-w-xl">{search}</div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/market" variant="secondary" className="min-h-11 px-6">
              {t("ctaMarket")}
            </ButtonLink>
            <ButtonLink
              href="/calculators"
              variant="secondary"
              className="min-h-11 px-6"
            >
              {t("ctaCalculators")}
            </ButtonLink>
          </div>
        </div>

        <Reveal delay={120}>
          <MortgageTeaser />
        </Reveal>
      </div>
    </section>
  );
}
