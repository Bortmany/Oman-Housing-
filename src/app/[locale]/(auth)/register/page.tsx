import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RegisterForm } from "./RegisterForm";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-stone-900">
        {t("registerTitle")}
      </h1>
      <div className="mt-6">
        <RegisterForm />
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
