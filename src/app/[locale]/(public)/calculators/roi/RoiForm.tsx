"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { roi } from "@/lib/calculators/roi";
import { formatOMR, formatOMRWhole, formatPercent } from "@/lib/money";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import { TrendChart } from "@/components/charts/TrendChart";

// Matches the Input's min/max below — re-checked here because the browser's
// HTML validation can always be bypassed (typed past it, pasted, autofill).
const HORIZON_MIN = 1;
const HORIZON_MAX = 30;

export function RoiForm() {
  const t = useTranslations("calculators.roi");
  const tc = useTranslations("calculators");
  const locale = useLocale();

  const [price, setPrice] = useState(100_000);
  const [down, setDown] = useState(20_000);
  const [rent, setRent] = useState(550);
  const [expenses, setExpenses] = useState(80);
  const [mortgagePmt, setMortgagePmt] = useState(465);
  const [growth, setGrowth] = useState(2);
  const [years, setYears] = useState(10);

  const yearsValid =
    Number.isFinite(years) && years >= HORIZON_MIN && years <= HORIZON_MAX;

  const r = roi({
    purchasePrice: price,
    downPayment: down,
    monthlyRent: rent,
    monthlyExpenses: expenses,
    monthlyMortgage: mortgagePmt,
    annualAppreciationPct: growth,
    // An out-of-range horizon never reaches the projection loop — the
    // calculator just shows zeros until the visitor enters a valid term.
    horizonYears: yearsValid ? years : 0,
  });

  const chartData = r.yearly.map((y) => ({
    label: String(y.year),
    cashflow: Math.round(y.cumulativeCashFlow),
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="price">{t("purchasePrice")}</Label>
          <Input id="price" type="number" min={0} value={price}
            onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="down">{t("downPayment")}</Label>
          <Input id="down" type="number" min={0} value={down}
            onChange={(e) => setDown(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="rent">{t("monthlyRent")}</Label>
          <Input id="rent" type="number" min={0} value={rent}
            onChange={(e) => setRent(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="expenses">{t("monthlyExpenses")}</Label>
          <Input id="expenses" type="number" min={0} value={expenses}
            onChange={(e) => setExpenses(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="mortgagePmt">{t("monthlyMortgage")}</Label>
          <Input id="mortgagePmt" type="number" min={0} value={mortgagePmt}
            onChange={(e) => setMortgagePmt(Number(e.target.value))} />
          <Hint>{t("monthlyMortgageHint")}</Hint>
        </div>
        <div>
          <Label htmlFor="growth">{t("appreciation")}</Label>
          <Input id="growth" type="number" step={0.5} value={growth}
            onChange={(e) => setGrowth(Number(e.target.value))} />
          <Hint>{t("appreciationHint")}</Hint>
        </div>
        <div>
          <Label htmlFor="years">{t("horizon")}</Label>
          <Input
            id="years"
            type="number"
            min={HORIZON_MIN}
            max={HORIZON_MAX}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            error={!yearsValid}
            aria-describedby={!yearsValid ? "years-error" : undefined}
          />
          {!yearsValid && (
            <FieldError>
              <span id="years-error">
                {t("horizonRangeError", { min: HORIZON_MIN, max: HORIZON_MAX })}
              </span>
            </FieldError>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-stone-900">{tc("results")}</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <CardTitle>{t("monthlyCashFlow")}</CardTitle>
            <dd
              className={`text-3xl font-bold ${
                r.monthlyCashFlow >= 0 ? "text-teal-800" : "text-rose-700"
              }`}
            >
              {formatOMR(r.monthlyCashFlow, locale)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4 text-sm">
            <div>
              <dt className="text-xs text-stone-500">{t("annualCashFlow")}</dt>
              <dd className="font-semibold">{formatOMR(r.annualCashFlow, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{t("cashOnCash")}</dt>
              <dd className="font-semibold">{formatPercent(r.cashOnCashPct, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{t("breakEven")}</dt>
              <dd className="font-semibold">
                {r.breakEvenMonths != null
                  ? t("breakEvenMonths", {
                      months: r.breakEvenMonths,
                      years: Math.round(r.breakEvenMonths / 12),
                    })
                  : t("neverBreaksEven")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">
                {t("totalReturn", { years })}
              </dt>
              <dd className="font-semibold">{formatOMRWhole(r.totalReturn, locale)}</dd>
            </div>
          </div>
        </dl>
        {chartData.length > 1 && (
          <div className="mt-6">
            <CardTitle>{t("cumulativeCashFlow")}</CardTitle>
            <div className="mt-2">
              <TrendChart
                data={chartData}
                series={[{ key: "cashflow", name: t("cumulativeCashFlow") }]}
                height={200}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
