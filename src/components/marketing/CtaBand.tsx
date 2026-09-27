import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { getSignupMode } from "@/lib/signupMode";

// Closing band: browse listings, and the agency invitation. The agency card's
// wording follows the real sign-up switch (src/lib/signupMode.ts) so the home
// page never promises a sign-up the list-with-us page would then refuse.
export async function CtaBand() {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);
  const tight = locale === "ar" ? "" : "tracking-tight";
  const mode = getSignupMode();

  const listBody =
    mode === "open"
      ? t("listCtaBody")
      : mode === "invite"
        ? t("listCtaBodyInvite")
        : t("listCtaBodyClosed");
  const listButton =
    mode === "closed" ? t("listCtaButtonClosed") : t("listCtaButton");

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <h2
            className={`text-start text-xl font-bold text-stone-900 sm:text-2xl dark:text-stone-100 ${tight}`}
          >
            {t("propertiesCtaTitle")}
          </h2>
          <p className="mt-3 max-w-md text-start text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            {t("propertiesCtaBody")}
          </p>
          <div className="mt-6">
            <ButtonLink href="/properties" className="min-h-11 px-6">
              {t("propertiesCtaButton")}
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-900 p-8 shadow-sm dark:ring-1 dark:ring-brand-800">
          <h2
            className={`text-start text-xl font-bold text-white sm:text-2xl ${tight}`}
          >
            {t("listCtaTitle")}
          </h2>
          <p className="mt-3 max-w-md text-start text-sm leading-relaxed text-brand-100">
            {listBody}
          </p>
          <div className="mt-6">
            <Link
              href="/list-with-us"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-6 py-2 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-brand-100"
            >
              {listButton}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
