import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("legal.terms");
  return { title: t("title") };
}

// Plain-language terms of use. The wording is a template for the owner to
// have professionally reviewed (the visible notice below says so).
export default async function TermsPage() {
  const [t, tl] = await Promise.all([
    getTranslations("legal.terms"),
    getTranslations("legal"),
  ]);

  const sections = [
    ["infoTitle", "infoBody"],
    ["aiTitle", "aiBody"],
    ["accountsTitle", "accountsBody"],
    ["listingsTitle", "listingsBody"],
    ["liabilityTitle", "liabilityBody"],
    ["lawTitle", "lawBody"],
    ["changesTitle", "changesBody"],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
      <p className="mt-2 text-sm text-stone-500">{t("updated")}</p>

      <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
        {tl("templateNotice")}
      </div>

      <p className="mt-6 text-sm leading-6 text-stone-700">{t("intro")}</p>

      {sections.map(([titleKey, bodyKey]) => (
        <section key={titleKey}>
          <h2 className="mt-8 text-lg font-semibold text-stone-900">
            {t(titleKey)}
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-700">{t(bodyKey)}</p>
        </section>
      ))}

      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {tl("contactTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        {tl("contactBody")}
      </p>
    </div>
  );
}
