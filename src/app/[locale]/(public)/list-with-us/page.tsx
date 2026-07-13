import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { AgencySignupForm } from "./AgencySignupForm";
import { Link } from "@/i18n/navigation";

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

      <div className="mt-8">
        <AgencySignupForm />
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
