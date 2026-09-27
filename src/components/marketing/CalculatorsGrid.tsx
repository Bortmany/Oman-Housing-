import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const CALCULATORS = [
  {
    href: "/calculators/affordability",
    titleKey: "calcAffordTitle",
    bodyKey: "calcAffordBody",
  },
  {
    href: "/calculators/mortgage",
    titleKey: "calcMortgageTitle",
    bodyKey: "calcMortgageBody",
  },
  {
    href: "/calculators/rental-yield",
    titleKey: "calcYieldTitle",
    bodyKey: "calcYieldBody",
  },
  {
    href: "/calculators/roi",
    titleKey: "calcRoiTitle",
    bodyKey: "calcRoiBody",
  },
] as const;

export async function CalculatorsGrid() {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);
  const tight = locale === "ar" ? "" : "tracking-tight";
  const wide = locale === "ar" ? "" : "tracking-wide";

  return (
    <section className="border-y border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="text-start">
          <span
            className={`text-xs font-semibold text-brand-700 uppercase rtl:text-sm dark:text-brand-200 ${wide}`}
          >
            {t("calcKicker")}
          </span>
          <h2
            className={`mt-2 max-w-lg text-2xl font-bold text-stone-900 sm:text-3xl dark:text-stone-100 ${tight}`}
          >
            {t("calcTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-stone-600 dark:text-stone-300">
            {t("calcSubtitle")}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CALCULATORS.map((calc) => (
            <Link
              key={calc.href}
              href={calc.href}
              className="group block rounded-2xl bg-stone-50 p-6 ring-1 ring-stone-200 transition hover:bg-brand-50 hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:bg-stone-950 dark:ring-stone-800 dark:hover:bg-brand-950 dark:hover:ring-brand-800"
            >
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {t(calc.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                {t(calc.bodyKey)}
              </p>
              <span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 group-hover:underline dark:text-brand-200">
                {t("calcOpen")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
