import { useLocale, useTranslations } from "next-intl";
import type { Figure, PropertyFinancials } from "@/lib/db/valuations";
import { formatOMR, formatOMRWhole, formatPercent } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";

const NOTE_CLASS =
  "mt-1 text-xs leading-relaxed text-stone-500 text-start rtl:text-sm dark:text-stone-400";

function Row({
  label,
  figure,
  format,
  locale,
  insufficientLabel,
  note,
  muted = false,
}: {
  label: string;
  figure: Figure | null;
  format: (v: number, locale: string) => string;
  locale: string;
  insufficientLabel: string;
  /** One small line under the row saying how the figure was worked out. */
  note?: string | null;
  /** Draw the figure in the muted style (an area-average fallback). */
  muted?: boolean;
}) {
  return (
    <div className="border-b border-stone-100 py-2.5 last:border-0 dark:border-stone-800">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <dt className="text-sm text-stone-600 dark:text-stone-300">{label}</dt>
        <dd className="flex items-center gap-2 text-end">
          {figure ? (
            <>
              <span
                className={
                  muted
                    ? "font-semibold text-stone-500 dark:text-stone-400"
                    : "font-semibold text-stone-900 dark:text-stone-100"
                }
              >
                {format(figure.value, locale)}
              </span>
              {figure.isSample ? (
                <ProvenanceBadge isSample />
              ) : (
                <ProvenanceBadge
                  provenance={figure.provenance}
                  confidence={figure.confidence}
                />
              )}
            </>
          ) : (
            <span className="text-sm text-stone-400 dark:text-stone-500">{insufficientLabel}</span>
          )}
        </dd>
      </div>
      {note && <p className={NOTE_CLASS}>{note}</p>}
    </div>
  );
}

const bandStyles: Record<string, string> = {
  STRONG: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  MODERATE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  WEAK: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  INSUFFICIENT_DATA: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

export function FinancialAnalysisCard({
  financials,
}: {
  financials: PropertyFinancials;
}) {
  const locale = useLocale();
  const t = useTranslations("properties");
  const tc = useTranslations("common");
  const na = t("insufficientData");
  const f = financials;

  // The notes only put the calculator's facts into words; no maths here.
  const valueNote =
    f.estimatedValue && f.estimatedValueBasis === "AREA_AVERAGE"
      ? t("valueBasisAreaAverage")
      : null;

  const listedRentNote =
    f.listedRent && f.listedRentAnnual != null
      ? t("listedRentFromAnnual", { annual: formatOMRWhole(f.listedRentAnnual, locale) })
      : null;

  let expectedRentNote: string | null = null;
  if (f.expectedRent && f.expectedRentBasis === "THIS_PROPERTY" &&
      f.floorAreaSqm != null && f.rentPerSqm != null) {
    expectedRentNote = t("rentBasisThisProperty", {
      area: `${f.floorAreaSqm} ${tc("sqm")}`,
      rentPerSqm: formatOMR(f.rentPerSqm, locale),
    });
  } else if (f.expectedRent && f.expectedRentBasis === "AREA_AVERAGE") {
    expectedRentNote = t("rentBasisAreaAverage");
  }

  let yieldNote: string | null = null;
  if (f.grossYieldPct && f.yieldRentUsed != null && f.yieldBasis === "ASKING") {
    yieldNote = t("yieldBasisAsking", { rent: formatOMRWhole(f.yieldRentUsed, locale) });
  } else if (f.grossYieldPct && f.yieldRentUsed != null && f.yieldBasis === "ESTIMATE") {
    yieldNote = t("yieldBasisEstimate", { rent: formatOMRWhole(f.yieldRentUsed, locale) });
  } else if (!f.grossYieldPct && !f.listedRent) {
    yieldNote = t("yieldBasisNone");
  } else if (!f.grossYieldPct && !f.estimatedValue &&
             f.investment.band !== "INSUFFICIENT_DATA") {
    // An advertised rent but no value at all: say why there is no yield —
    // unless the card footer already shows this same explanation.
    // (With an area-average value, the value row already says it.)
    yieldNote = t("insufficientDataHint");
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
        {t("financialAnalysis")}
      </h2>
      <dl className="mt-3">
        <Row label={t("estimatedValue")} figure={f.estimatedValue}
          format={formatOMRWhole} locale={locale} insufficientLabel={na}
          note={valueNote} muted={f.estimatedValueBasis === "AREA_AVERAGE"} />
        <Row label={t("pricePerSqm")} figure={f.pricePerSqm}
          format={formatOMR} locale={locale} insufficientLabel={na} />
        <Row label={t("listedRent")} figure={f.listedRent}
          format={formatOMRWhole} locale={locale} insufficientLabel={na}
          note={listedRentNote} />
        <Row label={t("expectedRent")} figure={f.expectedRent}
          format={formatOMRWhole} locale={locale} insufficientLabel={na}
          note={expectedRentNote} muted={f.expectedRentBasis === "AREA_AVERAGE"} />
        <Row label={t("rentalYield")} figure={f.grossYieldPct}
          format={formatPercent} locale={locale} insufficientLabel={na}
          note={yieldNote} />

        <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <dt className="text-sm text-stone-600 dark:text-stone-300">{t("investmentScore")}</dt>
          <dd className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${bandStyles[f.investment.band]}`}
            >
              {f.investment.score != null
                ? `${f.investment.score}/100 · `
                : ""}
              {t(`scoreBand.${f.investment.band}`)}
            </span>
            {f.investment.score != null &&
              f.investmentConfidence != null &&
              (f.investmentIsSample ? (
                <ProvenanceBadge isSample />
              ) : (
                <ProvenanceBadge
                  provenance="AI_ESTIMATED"
                  confidence={f.investmentConfidence}
                />
              ))}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        {f.investment.band === "INSUFFICIENT_DATA"
          ? t("insufficientDataHint")
          : t("scoreDisclaimer")}
      </p>
    </Card>
  );
}
