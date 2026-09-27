import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { localName } from "@/lib/i18nData";

// Enough shortcuts to be useful, few enough to stay one or two tidy rows.
const CHIP_LIMIT = 12;

// "Browse by neighborhood": one tap from the home page to the listings in an
// area. Real neighborhoods from the database, so nothing here is invented.
export async function NeighborhoodShortcuts() {
  const [t, locale, neighborhoods] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    allNeighborhoods(),
  ]);

  const chips = neighborhoods.slice(0, CHIP_LIMIT);
  if (chips.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-12">
      <h2 className="text-start text-base font-semibold text-stone-900 dark:text-stone-100">
        {t("browseTitle")}
      </h2>
      <p className="mt-1 text-start text-sm text-stone-600 dark:text-stone-300">
        {t("browseSubtitle")}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {chips.map((n) => (
          <li key={n.slug}>
            <Link
              href={{ pathname: "/properties", query: { hood: n.slug } }}
              className="inline-flex min-h-11 items-center rounded-full bg-white px-4 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 transition-colors hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-teal-950 dark:hover:text-teal-200"
            >
              {localName(locale, n.nameEn, n.nameAr)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
