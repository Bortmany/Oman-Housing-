import { useLocale, useTranslations } from "next-intl";
import type { Figure, PropertyFinancials } from "@/lib/db/valuations";
import { formatOMR, formatOMRWhole, formatPercent } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";

function Row({
  label,
  figure,
  format,
  locale,
  insufficientLabel,
}: {
  label: string;
  figure: Figure | null;
  format: (v: number, locale: string) => string;
  locale: string;
  insufficientLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 py-2.5 last:border-0">
      <dt className="text-sm text-stone-600">{label}</dt>
      <dd className="flex items-center gap-2 text-end">
        {figure ? (
          <>
            <span className="font-semibold text-stone-900">
              {format(figure.value, locale)}
            </span>
            <ProvenanceBadge
              provenance={figure.provenance}
              confidence={figure.confidence}
            />
          </>
        ) : (
          <span className="text-sm text-stone-400">{insufficientLabel}</span>
        )}
      </dd>
    </div>
  );
}

const bandStyles: Record<string, string> = {
  STRONG: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  WEAK: "bg-rose-100 text-rose-800",
  INSUFFICIENT_DATA: "bg-stone-100 text-stone-500",
};

export function FinancialAnalysisCard({
  financials,
}: {
  financials: PropertyFinancials;
}) {
  const locale = useLocale();
  const t = useTranslations("properties");
  const na = t("insufficientData");

  return (
    <Card>
      <h2 className="text-base font-semibold text-stone-900">
        {t("financialAnalysis")}
      </h2>
      <dl className="mt-3">
        <Row label={t("estimatedValue")} figure={financials.estimatedValue}
          format={formatOMRWhole} locale={locale} insufficientLabel={na} />
        <Row label={t("pricePerSqm")} figure={financials.pricePerSqm}
          format={formatOMR} locale={locale} insufficientLabel={na} />
        <Row label={t("listedRent")} figure={financials.listedRent}
          format={formatOMRWhole} locale={locale} insufficientLabel={na} />
        <Row label={t("expectedRent")} figure={financials.expectedRent}
          format={formatOMRWhole} locale={locale} insufficientLabel={na} />
        <Row label={t("rentalYield")} figure={financials.grossYieldPct}
          format={formatPercent} locale={locale} insufficientLabel={na} />

        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-sm text-stone-600">{t("investmentScore")}</dt>
          <dd className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${bandStyles[financials.investment.band]}`}
            >
              {financials.investment.score != null
                ? `${financials.investment.score}/100 · `
                : ""}
              {t(`scoreBand.${financials.investment.band}`)}
            </span>
            {financials.investment.score != null &&
              financials.investmentConfidence != null && (
                <ProvenanceBadge
                  provenance="AI_ESTIMATED"
                  confidence={financials.investmentConfidence}
                />
              )}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-stone-500">
        {financials.investment.band === "INSUFFICIENT_DATA"
          ? t("insufficientDataHint")
          : t("scoreDisclaimer")}
      </p>
    </Card>
  );
}
