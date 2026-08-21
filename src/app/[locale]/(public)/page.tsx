import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { localName } from "@/lib/i18nData";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Input, Select } from "@/components/ui/Field";

// The same property types the /properties page and its filters accept.
const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;

// Enough shortcuts to be useful, few enough to stay one or two tidy rows.
const CHIP_LIMIT = 12;

export default async function HomePage() {
  const [t, te, locale, neighborhoods] = await Promise.all([
    getTranslations("home"),
    getTranslations("enums"),
    getLocale(),
    allNeighborhoods(),
  ]);

  const features = [
    { title: t("featureMarketTitle"), body: t("featureMarketBody") },
    { title: t("featureCompareTitle"), body: t("featureCompareBody") },
    { title: t("featureCalcTitle"), body: t("featureCalcBody") },
  ];

  // A plain GET form needs a real URL to submit to; getPathname builds the
  // locale-prefixed one ("/ar/properties") without hand-writing prefixes.
  const searchAction = getPathname({
    href: "/properties",
    locale: locale as Locale,
  });

  const chips = neighborhoods.slice(0, CHIP_LIMIT);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 text-center sm:py-24">
        {/* tracking-tight suits large Latin headings only — tightening breaks
            Arabic's connected letterforms, so the Arabic heading keeps normal spacing. */}
        <h1
          className={`mx-auto max-w-3xl text-4xl font-bold text-stone-900 sm:text-5xl dark:text-stone-100 ${
            locale === "ar" ? "" : "tracking-tight"
          }`}
        >
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-stone-600 dark:text-stone-300">
          {t("heroSubtitle")}
        </p>

        {/* Search: no JavaScript, just a GET form that lands on the property
            search with the same query parameters that page already reads. */}
        <Card className="mx-auto mt-8 max-w-3xl text-start">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {t("searchTitle")}
          </h2>
          <form
            method="get"
            action={searchAction}
            className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-4"
          >
            <div>
              <Label htmlFor="home-type">{t("searchType")}</Label>
              <Select id="home-type" name="type" defaultValue="">
                <option value="">{t("searchAny")}</option>
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {te(`propertyType.${pt}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="home-listing-type">{t("searchListingType")}</Label>
              <Select id="home-listing-type" name="listingType" defaultValue="">
                <option value="">{t("searchAny")}</option>
                <option value="SALE">{t("searchSale")}</option>
                <option value="RENT">{t("searchRent")}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="home-max-price">{t("searchMaxPrice")}</Label>
              <Input
                id="home-max-price"
                name="maxPrice"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder={t("searchMaxPricePlaceholder")}
              />
            </div>
            <Button type="submit">{t("searchSubmit")}</Button>
          </form>
        </Card>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/market">{t("ctaMarket")}</ButtonLink>
          <ButtonLink href="/calculators" variant="secondary">
            {t("ctaCalculators")}
          </ButtonLink>
        </div>
      </section>

      {chips.length > 0 && (
        <section className="pb-12">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {t("browseTitle")}
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            {t("browseSubtitle")}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {chips.map((n) => (
              <li key={n.slug}>
                <Link
                  href={{ pathname: "/properties", query: { hood: n.slug } }}
                  className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-teal-50 hover:text-teal-800 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-teal-950 dark:hover:text-teal-200"
                >
                  {localName(locale, n.nameEn, n.nameAr)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 pb-12 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {f.title}
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {f.body}
            </p>
          </Card>
        ))}
      </section>

      <section className="pb-16">
        <Card className="border-s-4 border-teal-700">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {t("dataHonestyTitle")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-stone-600 dark:text-stone-300">
            {t("dataHonestyBody")}
          </p>
        </Card>
      </section>
    </div>
  );
}
