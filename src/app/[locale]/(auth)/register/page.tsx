import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSignupMode } from "@/lib/signupMode";
import { RegisterForm } from "./RegisterForm";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth");
  // Read on the server so the form knows whether to ask for an invite code
  // (the action re-checks — this only decides what the visitor sees).
  const signupMode = getSignupMode();

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-stone-900">
        {t("registerTitle")}
      </h1>
      <div className="mt-6">
        {signupMode === "closed" ? (
          <div
            role="status"
            className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700 ring-1 ring-inset ring-stone-200"
          >
            {t("signupClosed")}
          </div>
        ) : (
          <RegisterForm inviteRequired={signupMode === "invite"} />
        )}
      </div>
      <p className="mt-6 text-sm text-stone-600">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-teal-800">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
