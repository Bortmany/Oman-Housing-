import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const [t, tn] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
  ]);

  return (
    <footer className="mt-12 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-stone-500">
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/list-with-us" className="font-medium text-teal-800 hover:underline">
            {tn("agency")}
          </Link>
          <Link href="/privacy" className="font-medium text-teal-800 hover:underline">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="font-medium text-teal-800 hover:underline">
            {t("terms")}
          </Link>
        </p>
        {/* The regulatory disclaimer lives here so it is on every page. */}
        <p>{t("disclaimer")}</p>
        <p>© {t("rights")}</p>
      </div>
    </footer>
  );
}
