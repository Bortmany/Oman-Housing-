import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("legal.privacy");
  return { title: t("title") };
}

// Plain-language privacy policy. The wording is a template for the owner to
// have professionally reviewed (the visible notice below says so) and it is
// matched to what the app actually stores — see prisma/schema.prisma.
export default async function PrivacyPage() {
  const [t, tl] = await Promise.all([
    getTranslations("legal.privacy"),
    getTranslations("legal"),
  ]);

  const collectKeys = [
    "collectAccount",
    "collectEnquiry",
    "collectAgency",
    "collectPhotos",
    "collectAi",
    "collectFavorites",
    "collectTechnical",
  ] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
      <p className="mt-2 text-sm text-stone-500">{t("updated")}</p>

      <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
        {tl("templateNotice")}
      </div>

      <p className="mt-6 text-sm leading-6 text-stone-700">{t("intro")}</p>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {t("collectTitle")}
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
        {collectKeys.map((key) => (
          <li key={key}>• {t(key)}</li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {t("useTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">{t("useBody")}</p>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {t("shareTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">{t("shareBody")}</p>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {t("retentionTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        {t("retentionBody")}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {t("pdplTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">{t("pdplBody")}</p>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {tl("contactTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        {tl("contactBody")}
      </p>
    </div>
  );
}
