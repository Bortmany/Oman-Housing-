import { getTranslations } from "next-intl/server";
import { enforceAdminPage } from "@/lib/require-admin";
import { getFreeLaunchInfo } from "@/lib/siteSettings";
import { FreeLaunchCard } from "./FreeLaunchCard";

export async function generateMetadata() {
  const t = await getTranslations("adminSettings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const [t, info] = await Promise.all([getTranslations("adminSettings"), getFreeLaunchInfo()]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{t("subtitle")}</p>
      <div className="mt-6 space-y-4">
        <FreeLaunchCard initialOn={info.on} initialChangedAt={info.changedAt} />
        <p className="text-sm text-stone-600 dark:text-stone-300">{t("ownerCapNote")}</p>
      </div>
    </div>
  );
}
