import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";

// The same property types the /properties page and its filters accept.
const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;

// The home-page property search. No JavaScript: a plain GET form that lands
// on /properties with the same query parameters that page already reads.
export async function HomeSearch() {
  const [t, te, locale] = await Promise.all([
    getTranslations("home"),
    getTranslations("enums"),
    getLocale(),
  ]);

  // A plain GET form needs a real URL to submit to; getPathname builds the
  // locale-prefixed one ("/ar/properties") without hand-writing prefixes.
  const searchAction = getPathname({
    href: "/properties",
    locale: locale as Locale,
  });

  return (
    <div className="rounded-2xl bg-white p-5 text-start shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
        {t("searchTitle")}
      </h2>
      <form
        method="get"
        action={searchAction}
        className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2"
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
        <Button type="submit" className="min-h-11">
          {t("searchSubmit")}
        </Button>
      </form>
    </div>
  );
}
