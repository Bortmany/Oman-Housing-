import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { AgencySignupForm } from "./AgencySignupForm";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { ACTIVE_LISTING_LIMIT, TIER_ORDER, TIER_PRICE_OMR } from "@/lib/tiers";
import { formatOMRWhole } from "@/lib/money";
import { getSignupMode } from "@/lib/signupMode";
import { getFreeLaunch } from "@/lib/siteSettings";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("agency");
  return { title: t("signup.title") };
}

export default async function ListWithUsPage() {
  const [t, tf, session, locale, freeLaunch] = await Promise.all([
    getTranslations("agency"),
    getTranslations("freeLaunch"),
    auth(),
    getLocale(),
    getFreeLaunch(),
  ]);

  // An agency owner already signed in goes straight to their portal.
  if (session?.user.role === "AGENCY") redirect({ href: "/agency", locale });

  // Read on the server so the form knows whether to ask for an invite code
  // (the action re-checks — this only decides what the visitor sees).
  const signupMode = getSignupMode();

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">{t("signup.title")}</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-300">{t("signup.lede")}</p>

      <ul className="mt-6 space-y-2 text-sm text-stone-600 dark:text-stone-300">
        <li>• {t("signup.benefit1")}</li>
        <li>• {t("signup.benefit2")}</li>
        <li>• {t("signup.benefit3")}</li>
      </ul>

      <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/30">
        {t("signup.approvalNotice")}
      </div>

      {/* Plans and prices. Numbers come from src/lib/tiers.ts so the page can
          never drift from the limits the app actually enforces. */}
      {freeLaunch ? (
        // Free launch ON: no prices and no payment note, just the offer.
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-teal-50 p-6 text-teal-800 ring-1 ring-inset ring-teal-600/30 md:col-span-2 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-400/30">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 12v9H4v-9" />
              <path d="M2 7h20v5H2z" />
              <path d="M12 21V7" />
              <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
            </svg>
            <h2 className="mt-3 text-2xl font-bold">{tf("planName")}</h2>
            <p className="mt-2 text-sm">{tf("banner.body")}</p>
          </div>
          <Card className="flex flex-col">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">{tf("ownerCta.title")}</h3>
            <p className="mt-2 flex-1 text-sm text-stone-600 dark:text-stone-300">
              {tf("ownerCta.body", { limit: 3 })}
            </p>
            <ButtonLink href="/account/listings" variant="secondary" className="mt-4">
              {tf("ownerCta.button")}
            </ButtonLink>
          </Card>
        </section>
      ) : (
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {t("signup.pricing.heading")}
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t("signup.pricing.lede")}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {TIER_ORDER.map((tier) => {
            const limit = ACTIVE_LISTING_LIMIT[tier];
            return (
              <Card key={tier} className="flex flex-col">
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400">{t(`tier.${tier}`)}</p>
                <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {formatOMRWhole(TIER_PRICE_OMR[tier], locale)}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t("signup.pricing.perMonth")}</p>
                <p className="mt-3 text-sm font-medium text-stone-800 dark:text-stone-200">
                  {limit === Infinity
                    ? t("signup.pricing.listingsUnlimited")
                    : t("signup.pricing.listings", { count: limit })}
                </p>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                  {t(`signup.pricing.benefits.${tier}`)}
                </p>
              </Card>
            );
          })}
        </div>

        <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {t("signup.pricing.manualNote")}
        </p>
      </section>
      )}

      <div className="mt-8">
        {signupMode === "closed" ? (
          <div
            role="status"
            className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700 ring-1 ring-inset ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-800"
          >
            {t("signup.closed")}
          </div>
        ) : (
          <AgencySignupForm inviteRequired={signupMode === "invite"} />
        )}
      </div>

      <p className="mt-6 text-sm text-stone-600 dark:text-stone-300">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-teal-800 dark:text-teal-300">
          {t("signup.signIn")}
        </Link>
      </p>
    </div>
  );
}
