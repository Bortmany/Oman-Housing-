import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Shown inside the locale layout, so Arabic visitors get Arabic text (and the
// right-to-left page) instead of the plain English default.
export default async function LocaleNotFound() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">{t("notFound")}</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-300">{t("notFoundHint")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
      >
        {t("goHome")}
      </Link>
    </div>
  );
}
