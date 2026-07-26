import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";

export async function CtaBand() {
  const t = await getTranslations("home");

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-start text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
            {t("propertiesCtaTitle")}
          </h2>
          <p className="mt-3 max-w-md text-start text-sm leading-relaxed text-stone-600">
            {t("propertiesCtaBody")}
          </p>
          <div className="mt-6">
            <ButtonLink href="/properties" className="min-h-11 px-6">
              {t("propertiesCtaButton")}
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-900 p-8 shadow-sm">
          <h2 className="text-start text-xl font-bold tracking-tight text-white sm:text-2xl">
            {t("listCtaTitle")}
          </h2>
          <p className="mt-3 max-w-md text-start text-sm leading-relaxed text-brand-100">
            {t("listCtaBody")}
          </p>
          <div className="mt-6">
            <Link
              href="/list-with-us"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-6 py-2 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
            >
              {t("listCtaButton")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
