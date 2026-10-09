import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { enforceAdminPage } from "@/lib/require-admin";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { AdForm } from "../AdForm";
import { createAdAction } from "../actions";

export async function generateMetadata() {
  const t = await getTranslations("adminAds");
  return { title: t("newTitle") };
}

export default async function NewAdPage() {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const [t, locale, hoods] = await Promise.all([
    getTranslations("adminAds"),
    getLocale(),
    prisma.neighborhood.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameAr: true } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("newTitle")}</h1>
      <Card>
        <AdForm
          action={createAdAction}
          editing={false}
          neighborhoods={hoods.map((h) => ({ id: h.id, label: localName(locale, h.nameEn, h.nameAr) }))}
          initial={{ advertiser: "", slot: "HOME_BAND", neighborhoodId: "", linkUrl: "", altEn: "", altAr: "", startsAt: "", endsAt: "", agreedPrice: "" }}
        />
      </Card>
    </div>
  );
}
