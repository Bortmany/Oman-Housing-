"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { affordability } from "@/lib/calculators/affordability";
import type { MortgageMode } from "@/lib/calculators/mortgage";
import { formatOMR, formatOMRWhole } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";

// Matches the Input min/max below — re-checked here because the browser's own
// validation can always be bypassed (typed past it, pasted, autofill).
const YEARS_MIN = 1;
const YEARS_MAX = 35;
const INCOME_MAX = 100_000; // OMR a month — far beyond any real salary
const RATE_MAX = 30; // 30% — no real mortgage/profit rate gets near this

export function AffordabilityForm() {
  const t = useTranslations("calculators.affordability");
  const tc = useTranslations("calculators");
  const tm = useTranslations("calculators.mortgage");
  const locale = useLocale();

  const [mode, setMode] = useState<MortgageMode>("conventional");
  const [income, setIncome] = useState(1_500);
  const [obligations, setObligations] = useState(200);
  const [down, setDown] = useState(20_000);
  const [rate, setRate] = useState(5.0);
  const [years, setYears] = useState(25);

  const incomeValid =
    Number.isFinite(income) && income >= 0 && income <= INCOME_MAX;
  const obligationsValid =
    Number.isFinite(obligations) &&
    obligations >= 0 &&
    obligations <= INCOME_MAX;
  const rateValid = Number.isFinite(rate) && rate >= 0 && rate <= RATE_MAX;
  const yearsValid =
    Number.isFinite(years) && years >= YEARS_MIN && years <= YEARS_MAX;

  const a = affordability({
    // An out-of-range figure never reaches the math — the calculator shows
    // zeros until the visitor enters something valid.
    monthlyIncome: incomeValid ? income : 0,
    monthlyObligations: obligationsValid ? obligations : 0,
    downPayment: down,
    annualRatePct: rateValid ? rate : 0,
    years: yearsValid ? years : 0,
    mode,
  });

  const budget = Math.round(a.maxPropertyPrice);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-4">
        <div>
          <Label>{tm("mode")}</Label>
          <div className="flex gap-2">
            {(["conventional", "islamic"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
                  mode === value
                    ? "bg-teal-800 text-white ring-teal-800 dark:bg-teal-600 dark:ring-teal-600"
                    : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800"
                }`}
              >
                {tm(value)}
              </button>
            ))}
          </div>
          {mode === "islamic" && <Hint>{tm("islamicHint")}</Hint>}
        </div>

        <div>
          <Label htmlFor="income">{t("monthlyIncome")}</Label>
          <Input
            id="income"
            type="number"
            min={0}
            max={INCOME_MAX}
            value={income}
            onChange={(e) => setIncome(Number(e.target.value))}
            error={!incomeValid}
            aria-describedby={!incomeValid ? "income-error" : undefined}
          />
          {!incomeValid && (
            <FieldError>
              <span id="income-error">
                {t("incomeRangeError", { max: INCOME_MAX })}
              </span>
            </FieldError>
          )}
        </div>

        <div>
          <Label htmlFor="obligations">{t("monthlyObligations")}</Label>
          <Input
            id="obligations"
            type="number"
            min={0}
            max={INCOME_MAX}
            value={obligations}
            onChange={(e) => setObligations(Number(e.target.value))}
            error={!obligationsValid}
            aria-describedby={
              !obligationsValid ? "obligations-error" : undefined
            }
          />
          <Hint>{t("monthlyObligationsHint")}</Hint>
          {!obligationsValid && (
            <FieldError>
              <span id="obligations-error">
                {t("incomeRangeError", { max: INCOME_MAX })}
              </span>
            </FieldError>
          )}
        </div>

        <div>
          <Label htmlFor="down">{t("downPayment")}</Label>
          <Input
            id="down"
            type="number"
            min={0}
            value={down}
            onChange={(e) => setDown(Number(e.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="rate">
            {mode === "islamic" ? tm("profitRate") : tm("interestRate")}
          </Label>
          <Input
            id="rate"
            type="number"
            min={0}
            max={RATE_MAX}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            error={!rateValid}
            aria-describedby={!rateValid ? "rate-error" : undefined}
          />
          {!rateValid && (
            <FieldError>
              <span id="rate-error">{tm("rateRangeError", { max: RATE_MAX })}</span>
            </FieldError>
          )}
        </div>

        <div>
          <Label htmlFor="years">{tm("years")}</Label>
          <Input
            id="years"
            type="number"
            min={YEARS_MIN}
            max={YEARS_MAX}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            error={!yearsValid}
            aria-describedby={!yearsValid ? "years-error" : undefined}
          />
          {!yearsValid && (
            <FieldError>
              <span id="years-error">
                {tm("yearsRangeError", { min: YEARS_MIN, max: YEARS_MAX })}
              </span>
            </FieldError>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
          {tc("results")}
        </h2>
        <dl className="mt-4 space-y-4">
          <div>
            <CardTitle>{t("maxPropertyPrice")}</CardTitle>
            <dd className="text-3xl font-bold text-teal-800 dark:text-teal-300">
              {formatOMRWhole(a.maxPropertyPrice, locale)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4 text-sm dark:border-stone-800">
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">
                {t("maxMonthlyPayment")}
              </dt>
              <dd className="font-semibold">
                {formatOMR(a.maxMonthlyPayment, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">
                {t("maxLoan")}
              </dt>
              <dd className="font-semibold">
                {formatOMRWhole(a.maxLoan, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">
                {t("totalPaid")}
              </dt>
              <dd className="font-semibold">
                {formatOMRWhole(a.totalPaid, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">
                {mode === "islamic" ? tm("totalProfit") : tm("totalInterest")}
              </dt>
              <dd className="font-semibold">
                {formatOMRWhole(a.totalCharge, locale)}
              </dd>
            </div>
          </div>
        </dl>

        {/* The one assumption behind every figure above, said out loud. */}
        <p className="mt-4 rounded-lg bg-stone-100 p-3 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          {t("dbrNote", { cap: a.dbrCapPct })}
        </p>

        {budget > 0 && (
          <Link
            href={{ pathname: "/properties", query: { maxPrice: String(budget) } }}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {t("showHomes")}
          </Link>
        )}
      </Card>
    </div>
  );
}
