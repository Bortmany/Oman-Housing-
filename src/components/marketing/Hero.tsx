import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { MortgageTeaser } from "./MortgageTeaser";
import { Reveal } from "./Reveal";

export async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="border-b border-stone-200 bg-linear-to-b from-brand-50/70 via-white to-stone-50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-14">
        <div className="text-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-900">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand-700"
            />
            {t("heroBadge")}
          </span>
          <h1 className="mt-5 max-w-xl text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/market" className="min-h-11 px-6 text-base">
              {t("ctaMarket")}
            </ButtonLink>
            <ButtonLink
              href="/calculators"
              variant="secondary"
              className="min-h-11 px-6 text-base"
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
