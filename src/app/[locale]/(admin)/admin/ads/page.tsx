import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { enforceAdminPage } from "@/lib/require-admin";
import { formatDateTime, localName } from "@/lib/i18nData";
import { formatOMR } from "@/lib/money";
import { campaignTotals } from "@/lib/ads/core";
import { campaignStatus, clickRatePercent, type AdSlotName } from "@/lib/ads/rules";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { PendingButton } from "../payments/PendingButton";
import { toggleAdAction } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("adminAds");
  return { title: t("title") };
}

const STATUS_STYLE = {
  live: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
  scheduled: "bg-sky-50 text-sky-900 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-200",
  ended: "bg-stone-100 text-stone-700 ring-stone-500/20 dark:bg-stone-800 dark:text-stone-300",
  paused: "bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200",
} as const;

export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const sp = await searchParams;
  const [t, locale, campaigns] = await Promise.all([
    getTranslations("adminAds"),
    getLocale(),
    prisma.adCampaign.findMany({
      orderBy: [{ startsAt: "desc" }],
      take: 200,
      include: { neighborhood: { select: { nameEn: true, nameAr: true } } },
    }),
  ]);
  const totals = await campaignTotals(campaigns.map((c) => c.id));
  const now = new Date();
  const dt = (d: Date) => formatDateTime(locale, d);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t("dashHint")}</p>
        </div>
        <ButtonLink href="/admin/ads/new">{t("new")}</ButtonLink>
      </div>

      {sp.done && t.has(`done.${sp.done}`) && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100">
          {t(`done.${sp.done}`)}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          {t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}`) : t("errors.failed")}
        </p>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600 dark:text-stone-300">{t("empty")}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => {
            const status = campaignStatus(c, now);
            const sum = totals.get(c.id) ?? { views: 0, clicks: 0 };
            const rate = clickRatePercent(sum.views, sum.clicks);
            return (
              <li key={c.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-stone-900 dark:text-stone-100">{c.advertiser}</h2>
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        {t(`slot.${c.slot as AdSlotName}`)}
                        {c.neighborhood && ` · ${localName(locale, c.neighborhood.nameEn, c.neighborhood.nameAr)}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset rtl:text-sm ${STATUS_STYLE[status]}`}>
                      {t(`status.${status}`)}
                    </span>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2"><dt className="inline font-medium">{t("period")}: </dt><dd className="inline" dir="ltr">{dt(c.startsAt)} → {dt(c.endsAt)}</dd></div>
                    <div><dt className="inline font-medium">{t("views")}: </dt><dd className="inline" dir="ltr">{sum.views}</dd></div>
                    <div><dt className="inline font-medium">{t("clicks")}: </dt><dd className="inline" dir="ltr">{sum.clicks}</dd></div>
                    <div><dt className="inline font-medium">{t("clickRate")}: </dt><dd className="inline" dir="ltr">{rate ?? "—"}</dd></div>
                    {c.agreedPrice && (
                      <div><dt className="inline font-medium">{t("form.agreedPrice")}: </dt><dd className="inline" dir="ltr">{formatOMR(c.agreedPrice.toString(), locale)}</dd></div>
                    )}
                  </dl>
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <Link href={`/admin/ads/${c.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300">
                      {t("openCampaign")}
                    </Link>
                    <form action={toggleAdAction} className="ms-auto">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="to" value={c.isActive ? "pause" : "resume"} />
                      <PendingButton variant="secondary">{c.isActive ? t("pause") : t("resume")}</PendingButton>
                    </form>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
