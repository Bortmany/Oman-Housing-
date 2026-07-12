import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "./LoginForm";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signInTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-stone-900">{t("signInTitle")}</h1>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-sm text-stone-600">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-teal-800">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}
