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

export async function generateMetadata() {
  const t = await getTranslations("agency");
  return { title: t("signup.title") };
}

export default async function ListWithUsPage() {
  const [t, session, locale] = await Promise.all([
    getTranslations("agency"),
    auth(),
    getLocale(),
  ]);

  // An agency owner already signed in goes straight to their portal.
  if (session?.user.role === "AGENCY") redirect({ href: "/agency", locale });

  // Read on the server so the form knows whether to ask for an invite code
  // (the action re-checks — this only decides what the visitor sees).
  const signupMode = getSignupMode();

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-3xl font-bold text-stone-900">{t("signup.title")}</h1>
      <p className="mt-2 text-stone-600">{t("signup.lede")}</p>

      <ul className="mt-6 space-y-2 text-sm text-stone-600">
        <li>• {t("signup.benefit1")}</li>
        <li>• {t("signup.benefit2")}</li>
        <li>• {t("signup.benefit3")}</li>
      </ul>

      <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
        {t("signup.approvalNotice")}
      </div>

      {/* Plans and prices. Numbers come from src/lib/tiers.ts so the page can
          never drift from the limits the app actually enforces. */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-stone-900">
          {t("signup.pricing.heading")}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{t("signup.pricing.lede")}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {TIER_ORDER.map((tier) => {
            const limit = ACTIVE_LISTING_LIMIT[tier];
            return (
              <Card key={tier} className="flex flex-col">
                <p className="text-sm font-medium text-stone-500">{t(`tier.${tier}`)}</p>
                <p className="mt-2 text-2xl font-bold text-stone-900">
                  {formatOMRWhole(TIER_PRICE_OMR[tier], locale)}
                </p>
                <p className="text-xs text-stone-500">{t("signup.pricing.perMonth")}</p>
                <p className="mt-3 text-sm font-medium text-stone-800">
                  {limit === Infinity
                    ? t("signup.pricing.listingsUnlimited")
                    : t("signup.pricing.listings", { count: limit })}
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {t(`signup.pricing.benefits.${tier}`)}
                </p>
              </Card>
            );
          })}
        </div>

        <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700">
          {t("signup.pricing.manualNote")}
        </p>
      </section>

      <div className="mt-8">
        {signupMode === "closed" ? (
          <div
            role="status"
            className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700 ring-1 ring-inset ring-stone-200"
          >
            {t("signup.closed")}
          </div>
        ) : (
          <AgencySignupForm inviteRequired={signupMode === "invite"} />
        )}
      </div>

      <p className="mt-6 text-sm text-stone-600">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-teal-800">
          {t("signup.signIn")}
        </Link>
      </p>
    </div>
  );
}
