import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { enforceAdminPage } from "@/lib/require-admin";
import { formatDateTime, localName } from "@/lib/i18nData";
import { AdCard } from "@/components/ads/AdCard";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import {
  AD_LABEL,
  buildAdView,
  campaignStatus,
  clickRatePercent,
  monthlyTotals,
  toOmanLocalInput,
} from "@/lib/ads/rules";
import { AdForm } from "../AdForm";
import { CopyButton } from "../CopyButton";
import { updateAdAction } from "../actions";

export async function generateMetadata() {
  const t = await getTranslations("adminAds");
  return { title: t("editTitle") };
}

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const { id } = await params;
  const [t, locale, campaign, hoods, daily] = await Promise.all([
    getTranslations("adminAds"),
    getLocale(),
    prisma.adCampaign.findUnique({ where: { id } }),
    prisma.neighborhood.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameAr: true } }),
    prisma.adDailyStat.findMany({ where: { campaignId: id }, orderBy: { day: "asc" } }),
  ]);
  if (!campaign) notFound();

  const status = campaignStatus(campaign, new Date());
  const views = daily.reduce((n, r) => n + r.views, 0);
  const clicks = daily.reduce((n, r) => n + r.clicks, 0);
  const rate = clickRatePercent(views, clicks) ?? "—";
  const months = monthlyTotals(daily);
  const tAds = await getTranslations("ads");
  const preview = buildAdView(campaign, locale, {
    linkHint: tAds("linkHint", { name: campaign.advertiser }),
    by: tAds("by", { name: campaign.advertiser }),
    altFallback: tAds("imageAltFallback", { name: campaign.advertiser }),
  });
  const reportText = t("report.text", {
    advertiser: campaign.advertiser,
    slot: t(`slot.${campaign.slot}`),
    period: `${formatDateTime(locale, campaign.startsAt)} - ${formatDateTime(locale, campaign.endsAt)}`,
    views: String(views),
    clicks: String(clicks),
    rate,
    note: t("report.note"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-1">
        <Link href="/admin/ads" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300">
          {t("backToList")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{campaign.advertiser}</h1>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-800 ring-1 ring-inset ring-stone-400/40 rtl:text-sm dark:bg-stone-800 dark:text-stone-200">
            {t(`status.${status}`)}
          </span>
        </div>
      </div>

      {/* Exactly what visitors see, label included */}
      <section className="space-y-2" aria-labelledby="preview-h">
        <h2 id="preview-h" className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("preview")}</h2>
        <p className="text-sm text-stone-600 dark:text-stone-300">{t("previewNote", { label: AD_LABEL })}</p>
        <div className="max-w-xl"><AdCard ad={preview} /></div>
      </section>

      <Card>
        <AdForm
          action={updateAdAction}
          editing
          neighborhoods={hoods.map((h) => ({ id: h.id, label: localName(locale, h.nameEn, h.nameAr) }))}
          initial={{
            id: campaign.id,
            advertiser: campaign.advertiser,
            slot: campaign.slot,
            neighborhoodId: campaign.neighborhoodId ?? "",
            linkUrl: campaign.linkUrl,
            altEn: campaign.altEn,
            altAr: campaign.altAr ?? "",
            startsAt: toOmanLocalInput(campaign.startsAt),
            endsAt: toOmanLocalInput(campaign.endsAt),
            agreedPrice: campaign.agreedPrice ? campaign.agreedPrice.toString() : "",
          }}
        />
      </Card>

      <section className="space-y-3" aria-labelledby="report-h">
        <h2 id="report-h" className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("report.title")}</h2>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <Card className="p-3"><dt className="text-stone-600 dark:text-stone-300">{t("views")}</dt><dd className="text-xl font-bold text-stone-900 dark:text-stone-100" dir="ltr">{views}</dd></Card>
          <Card className="p-3"><dt className="text-stone-600 dark:text-stone-300">{t("clicks")}</dt><dd className="text-xl font-bold text-stone-900 dark:text-stone-100" dir="ltr">{clicks}</dd></Card>
          <Card className="p-3"><dt className="text-stone-600 dark:text-stone-300">{t("clickRate")}</dt><dd className="text-xl font-bold text-stone-900 dark:text-stone-100" dir="ltr">{rate}</dd></Card>
        </dl>
        {months.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("report.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-stone-200 dark:ring-stone-800">
            <table className="w-full min-w-72 text-sm">
              <thead className="bg-stone-50 text-start text-stone-600 dark:bg-stone-900 dark:text-stone-300">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t("report.month")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t("views")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t("clicks")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t("clickRate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {months.map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className="px-3 py-2 text-start font-medium" dir="ltr">{m.month}</th>
                    <td className="px-3 py-2" dir="ltr">{m.views}</td>
                    <td className="px-3 py-2" dir="ltr">{m.clicks}</td>
                    <td className="px-3 py-2" dir="ltr">{clickRatePercent(m.views, m.clicks) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-stone-600 rtl:text-sm dark:text-stone-300">{t("report.note")}</p>
        <textarea
          readOnly
          rows={8}
          value={reportText}
          aria-label={t("report.title")}
          className="block w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        />
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton text={reportText} label={t("report.copy")} doneLabel={t("report.copied")} />
        </div>
      </section>
    </div>
  );
}
