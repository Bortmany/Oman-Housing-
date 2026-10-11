import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, formatMonth, formatDateTime } from "@/lib/i18nData";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { Link } from "@/i18n/navigation";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { enforceAdminPage } from "@/lib/require-admin";
import { deleteMarketStat } from "./actions";
import { RecomputeButton } from "./RecomputeButton";
import { currentMonthStartUtc } from "@/lib/listingAveragesJob";

export default async function MarketStatsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; updated?: string; replacedSample?: string; deleted?: string }>;
}) {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const { saved, updated, replacedSample, deleted } = await searchParams;
  const [t, tm, te, tl, tr, locale, stats, lastDerived, liveDerived] = await Promise.all([
    getTranslations("admin"),
    getTranslations("market"),
    getTranslations("enums"),
    getTranslations("listingAverages"),
    getTranslations("admin.review"),
    getLocale(),
    prisma.marketStat.findMany({
      orderBy: [{ periodStart: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        governorate: true,
        city: true,
        neighborhood: true,
      },
    }),
    // Last-run info comes from the newest derived figure (no run history is stored).
    prisma.marketStat.findFirst({
      where: { provenance: "LISTING_DERIVED" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.marketStat.count({
      where: { provenance: "LISTING_DERIVED", periodStart: currentMonthStartUtc() },
    }),
  ]);

  function scopeName(s: (typeof stats)[number]): string {
    if (s.neighborhood)
      return localName(locale, s.neighborhood.nameEn, s.neighborhood.nameAr);
    if (s.city) return localName(locale, s.city.nameEn, s.city.nameAr);
    if (s.governorate)
      return localName(locale, s.governorate.nameEn, s.governorate.nameAr);
    return t("wholeCountry");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("marketStats")}</h1>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <ButtonLink href="/admin/market-stats/new" className="flex-1 sm:flex-none">
            {t("newStat")}
          </ButtonLink>
          <ButtonLink
            href="/admin/market-stats/import"
            variant="secondary"
            className="flex-1 sm:flex-none"
          >
            {tl("bulkLink")}
          </ButtonLink>
        </div>
      </div>

      {(saved || deleted) && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30">
          {deleted
            ? t("deleted")
            : replacedSample
              ? t("replacedSample")
              : updated
                ? t("duplicateUpdated")
                : t("saved")}
        </p>
      )}

      <Card className="mt-6">
        <RecomputeButton>
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {tl("panelTitle")}
            </h2>
            <ProvenanceBadge provenance="LISTING_DERIVED" />
          </div>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{tl("panelBody")}</p>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            {lastDerived
              ? tl("lastRun", {
                  date: formatDateTime(locale, lastDerived.updatedAt),
                  n: liveDerived,
                })
              : tl("neverRun")}
          </p>
        </RecomputeButton>
      </Card>

      {stats.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-medium text-stone-700 dark:text-stone-300">{t("table.empty")}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("table.emptyStatsHint")}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {t("table.emptyBulkHint")}{" "}
            <Link
              href="/admin/market-stats/import"
              className="font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300"
            >
              {tl("bulkLink")}
            </Link>
          </p>
        </Card>
      ) : (
        <>
        {/* Phone (under 640 px): one card per figure, delete kept apart at the bottom. */}
        <ul className="mt-6 space-y-3 sm:hidden">
          {stats.map((s) => (
            <li key={s.id}>
              <Card className="space-y-3 p-4">
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100">{scopeName(s)}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {s.propertyType ? te(`propertyType.${s.propertyType}`) : tm("allTypes")}
                    {" · "}
                    {formatMonth(locale, s.periodStart)}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-stone-500 dark:text-stone-400">{t("table.price")}</dt>
                    <dd>{s.avgSalePrice ? formatOMRWhole(s.avgSalePrice.toString(), locale) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 dark:text-stone-400">{t("table.rent")}</dt>
                    <dd>{s.avgRentMonthly ? formatOMRWhole(s.avgRentMonthly.toString(), locale) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500 dark:text-stone-400">{t("table.yield")}</dt>
                    <dd>{s.grossYieldPct ? formatPercent(s.grossYieldPct.toString(), locale) : "—"}</dd>
                  </div>
                </dl>
                <div>
                  <ProvenanceBadge
                    provenance={s.provenance}
                    confidence={s.confidence}
                    isSample={s.isSample}
                    sampleSize={s.sampleSize}
                  />
                  {s.sourceUrl && !s.isSample && (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300"
                    >
                      {tr("sourceLink")}
                    </a>
                  )}
                </div>
                <form action={deleteMarketStat} className="border-t border-stone-200 pt-3 dark:border-stone-800">
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 active:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950"
                  >
                    {t("table.deleteFigure")}
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-6 hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200 sm:block dark:bg-stone-900 dark:ring-stone-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-start text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
                <th className="px-4 py-3 text-start font-medium">{t("table.area")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.type")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.period")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.price")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.rent")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.yield")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.source")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                  <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">
                    {scopeName(s)}
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                    {s.propertyType
                      ? te(`propertyType.${s.propertyType}`)
                      : tm("allTypes")}
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                    {formatMonth(locale, s.periodStart)}
                  </td>
                  <td className="px-4 py-3">
                    {s.avgSalePrice
                      ? formatOMRWhole(s.avgSalePrice.toString(), locale)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.avgRentMonthly
                      ? formatOMRWhole(s.avgRentMonthly.toString(), locale)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.grossYieldPct
                      ? formatPercent(s.grossYieldPct.toString(), locale)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ProvenanceBadge
                      provenance={s.provenance}
                      confidence={s.confidence}
                      isSample={s.isSample}
                      sampleSize={s.sampleSize}
                    />
                    {s.sourceUrl && !s.isSample && (
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={(s.sourceNote ?? "").slice(0, 200) || undefined}
                        className="mt-1 block text-xs font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300"
                      >
                        {tr("sourceLink")}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteMarketStat}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button variant="ghost" type="submit" className="!px-2 !py-1 text-xs">
                        ✕
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
