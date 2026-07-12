import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";

export default async function AccountPage() {
  const [t, session] = await Promise.all([getTranslations("account"), auth()]);
  if (!session) return null; // layout already redirects

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-stone-900">{t("title")}</h1>
      <Card className="mt-6 space-y-3 text-sm">
        <p>
          <span className="font-medium text-stone-500">{t("signedInAs")}:</span>{" "}
          {session.user.name ?? session.user.email}
        </p>
        <p>
          <span className="font-medium text-stone-500">{t("role")}:</span>{" "}
          {session.user.role}
        </p>
        <p>
          <span className="font-medium text-stone-500">{t("tier")}:</span>{" "}
          {session.user.tier}
        </p>
      </Card>
    </div>
  );
}
