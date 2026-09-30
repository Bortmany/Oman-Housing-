import { useTranslations } from "next-intl";
import type { DataProvenance, PropertyType } from "@prisma/client";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { formatOMRWhole, formatPercent } from "@/lib/money";
import { OfficialSourceLink } from "./OfficialSourceLink";
import { formatMonth } from "@/lib/i18nData";

export type AreaFigureRow = {
  id: string;
  propertyType: PropertyType | null;
  periodStart: Date;
  avgSalePrice: { toString(): string } | null;
  avgRentMonthly: { toString(): string } | null;
  avgPricePerSqm: { toString(): string } | null;
  grossYieldPct: { toString(): string } | null;
  provenance: DataProvenance;
  sourceUrl?: string | null;
  confidence: number;
  sampleSize: number | null;
  isSample: boolean;
};

const TYPE_ORDER: Array<PropertyType | null> = [null, "APARTMENT", "VILLA"];

function typeRank(type: PropertyType | null) {
  const i = TYPE_ORDER.indexOf(type);
  return i === -1 ? TYPE_ORDER.length : i;
}

/**
 * A whole-area (governorate or city) official figure, drawn so it cannot be
 * mistaken for a neighbourhood's own number: sky start edge, lighter type,
 * its own title and a sentence saying which area it covers. Every block
 * carries its own badge and month. Renders nothing when there are no rows.
 */
export function AreaFigureCard({
  title,
  note,
  rows,
  locale,
}: {
  title: string;
  note: string;
  rows: AreaFigureRow[];
  locale: string;
}) {
  const t = useTranslations("market");
  const te = useTranslations("enums");
  if (rows.length === 0) return null;

  const blocks = [...rows].sort(
    (a, b) => typeRank(a.propertyType) - typeRank(b.propertyType),
  );

  return (
    <section
      aria-label={title}
      className="rounded-xl border-s-4 border-sky-500 bg-sky-50/50 p-5 shadow-sm ring-1 ring-stone-200 dark:border-sky-400 dark:bg-stone-900 dark:ring-stone-800"
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
          fill="currentColor"
        >
          <path d="M10 1.5a6 6 0 0 0-6 6c0 4.2 5.2 10.4 5.4 10.6a.8.8 0 0 0 1.2 0C10.8 17.9 16 11.7 16 7.5a6 6 0 0 0-6-6Zm0 8.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
        </svg>
        {title}
      </h3>

      <div className="mt-4 space-y-4">
        {blocks.map((row) => {
          const figures = [
            { label: t("avgSalePrice"), value: row.avgSalePrice && formatOMRWhole(row.avgSalePrice.toString(), locale) },
            { label: t("avgRentMonthly"), value: row.avgRentMonthly && formatOMRWhole(row.avgRentMonthly.toString(), locale) },
            { label: t("avgPricePerSqm"), value: row.avgPricePerSqm && formatOMRWhole(row.avgPricePerSqm.toString(), locale) },
            { label: t("grossYield"), value: row.grossYieldPct && formatPercent(row.grossYieldPct.toString(), locale) },
          ].filter((f) => f.value);
          return (
            <div key={row.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-stone-500 rtl:text-sm dark:text-stone-400">
                  {row.propertyType
                    ? te(`propertyType.${row.propertyType}`)
                    : t("allTypes")}
                </p>
                <ProvenanceBadge
                  provenance={row.provenance}
                  confidence={row.confidence}
                  isSample={row.isSample}
                  sampleSize={row.sampleSize}
                />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-base">
                {figures.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
                      {f.label}
                    </dt>
                    <dd className="text-stone-900 dark:text-stone-100">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-1 flex items-center justify-between gap-2">
                <OfficialSourceLink
                  provenance={row.provenance}
                  sourceUrl={row.sourceUrl}
                />
                <p className="ms-auto text-xs text-stone-400 rtl:text-sm dark:text-stone-500">
                  {formatMonth(locale, row.periodStart)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-stone-700 rtl:text-base dark:text-stone-300">
        {note}
      </p>
    </section>
  );
}
