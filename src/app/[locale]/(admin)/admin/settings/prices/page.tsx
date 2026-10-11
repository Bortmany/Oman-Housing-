import { getLocale, getTranslations } from "next-intl/server";
import { enforceAdminPage } from "@/lib/require-admin";
import { formatDateTime } from "@/lib/i18nData";
import { getAllPriceRows } from "@/lib/payments/prices";
import { PRICE_DEFAULTS, PRICE_KEYS, amountOrDefault, daysOrDefault, type PriceKey } from "@/lib/payments/priceCore";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { PendingButton } from "../../payments/PendingButton";
import { savePriceAction } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("adminPrices");
  return { title: t("title") };
}

const inputClass =
  "mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

const FEATURED: Array<[PriceKey, string]> = [
  [PRICE_KEYS.featuredOwner, "featuredOwner"],
  [PRICE_KEYS.featuredAgency, "featuredAgency"],
  [PRICE_KEYS.featuredDays, "featuredDays"],
];
const ADS: Array<[PriceKey, string]> = [
  [PRICE_KEYS.adHomeBand, "adHomeBand"],
  [PRICE_KEYS.adMarketSidebar, "adMarketSidebar"],
  [PRICE_KEYS.adPropertyBelow, "adPropertyBelow"],
  [PRICE_KEYS.adNeighborhoodSponsor, "adNeighborhoodSponsor"],
];

export default async function AdminPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; key?: string }>;
}) {
  await enforceAdminPage(); // guard BEFORE any data is read (see require-admin.ts)
  const sp = await searchParams;
  const [t, locale, rows] = await Promise.all([getTranslations("adminPrices"), getLocale(), getAllPriceRows()]);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const field = ([key, label]: [PriceKey, string]) => {
    const row = byKey.get(key);
    const isDays = key === PRICE_KEYS.featuredDays;
    const current = isDays ? String(daysOrDefault(row?.raw)) : amountOrDefault(row?.raw, key);
    const failed = sp.error && sp.key === key;
    return (
      <li key={key}>
        <Card className="space-y-2">
          <form action={savePriceAction} className="space-y-2">
            <input type="hidden" name="key" value={key} />
            <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
              {t(label)}
              <input name="value" required inputMode="decimal" dir="ltr" defaultValue={current} aria-invalid={failed ? true : undefined} className={inputClass} />
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {t("builtIn", { value: PRICE_DEFAULTS[key] })} ·{" "}
              {row?.changedAt ? t("lastChanged", { date: formatDateTime(locale, new Date(row.changedAt)) }) : t("neverChanged")}
            </p>
            {failed && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}`) : t("errors.failed")}
              </p>
            )}
            {sp.saved === key && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{t("saved")}</p>}
            <PendingButton className="w-full sm:w-auto">{t("save")}</PendingButton>
          </form>
        </Card>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <Link href="/admin/payments" className="inline-flex min-h-11 items-center text-sm text-teal-800 hover:underline dark:text-teal-300">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
      <p className="text-sm text-stone-600 dark:text-stone-300">{t("help")}</p>
      {sp.error && !sp.key && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          {t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}`) : t("errors.failed")}
        </p>
      )}
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("sectionFeatured")}</h2>
      <ul className="space-y-3">{FEATURED.map(field)}</ul>
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("sectionAds")}</h2>
      <ul className="space-y-3">{ADS.map(field)}</ul>
    </div>
  );
}
