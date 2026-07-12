import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-12 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-stone-500">
        {/* The regulatory disclaimer lives here so it is on every page. */}
        <p>{t("disclaimer")}</p>
        <p>© {t("rights")}</p>
      </div>
    </footer>
  );
}
