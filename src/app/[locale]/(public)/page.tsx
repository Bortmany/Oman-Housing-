import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function HomePage() {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);

  const features = [
    { title: t("featureMarketTitle"), body: t("featureMarketBody") },
    { title: t("featureCompareTitle"), body: t("featureCompareBody") },
    { title: t("featureCalcTitle"), body: t("featureCalcBody") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 text-center sm:py-24">
        {/* tracking-tight suits large Latin headings only — tightening breaks
            Arabic's connected letterforms, so the Arabic heading keeps normal spacing. */}
        <h1
          className={`mx-auto max-w-3xl text-4xl font-bold text-stone-900 sm:text-5xl ${
            locale === "ar" ? "" : "tracking-tight"
          }`}
        >
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-stone-600">
          {t("heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/market">{t("ctaMarket")}</ButtonLink>
          <ButtonLink href="/calculators" variant="secondary">
            {t("ctaCalculators")}
          </ButtonLink>
        </div>
      </section>

      <section className="grid gap-4 pb-12 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <h2 className="text-base font-semibold text-stone-900">
              {f.title}
            </h2>
            <p className="mt-2 text-sm text-stone-600">{f.body}</p>
          </Card>
        ))}
      </section>

      <section className="pb-16">
        <Card className="border-s-4 border-teal-700">
          <h2 className="text-base font-semibold text-stone-900">
            {t("dataHonestyTitle")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-stone-600">
            {t("dataHonestyBody")}
          </p>
        </Card>
      </section>
    </div>
  );
}
