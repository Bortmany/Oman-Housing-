"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { mortgage, type MortgageMode } from "@/lib/calculators/mortgage";
import { formatOMR, formatOMRWhole } from "@/lib/money";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import { TrendChart } from "@/components/charts/TrendChart";

// Matches the Input's min/max below — re-checked here because the browser's
// HTML validation can always be bypassed (typed past it, pasted, autofill).
const YEARS_MIN = 1;
const YEARS_MAX = 35;

// Same pattern for price/rate: an extreme value (e.g. pasted or typed past
// the browser's own limit) produces a monthly payment hundreds of digits
// long that breaks the results card's layout. mortgage.ts clamps the same
// way as a defensive second line, but showing a friendly error here (rather
// than silently clamping) tells the visitor why the number looks wrong.
const PRICE_MAX = 10_000_000; // 10 million OMR — far beyond any real listing
const RATE_MAX = 30; // 30% — no real mortgage/profit rate gets near this

export function MortgageForm() {
  const t = useTranslations("calculators.mortgage");
  const tc = useTranslations("calculators");
  const locale = useLocale();

  const [mode, setMode] = useState<MortgageMode>("conventional");
  const [price, setPrice] = useState(120_000);
  const [down, setDown] = useState(24_000);
  const [rate, setRate] = useState(5.0);
  const [years, setYears] = useState(25);

  const yearsValid =
    Number.isFinite(years) && years >= YEARS_MIN && years <= YEARS_MAX;
  const priceValid =
    Number.isFinite(price) && price >= 0 && price <= PRICE_MAX;
  const rateValid = Number.isFinite(rate) && rate >= 0 && rate <= RATE_MAX;

  const m = mortgage({
    // An out-of-range price/rate/duration never reaches the amortization
    // math — the calculator just shows zeros until the visitor enters a
    // valid value (same pattern for all three fields).
    propertyPrice: priceValid ? price : 0,
    downPayment: down,
    annualRatePct: rateValid ? rate : 0,
    years: yearsValid ? years : 0,
    mode,
  });

  const chartData = m.schedule.map((p) => ({
    label: String(Math.round(p.month / 12)),
    balance: Math.round(p.balance),
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-4">
        <div>
          <Label>{t("mode")}</Label>
          <div className="flex gap-2">
            {(["conventional", "islamic"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
                  mode === value
                    ? "bg-teal-800 text-white ring-teal-800"
                    : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100"
                }`}
              >
                {t(value)}
              </button>
            ))}
          </div>
          {mode === "islamic" && <Hint>{t("islamicHint")}</Hint>}
        </div>
        <div>
          <Label htmlFor="price">{t("propertyPrice")}</Label>
          <Input
            id="price"
            type="number"
            min={0}
            max={PRICE_MAX}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            error={!priceValid}
            aria-describedby={!priceValid ? "price-error" : undefined}
          />
          {!priceValid && (
            <FieldError>
              <span id="price-error">
                {t("priceRangeError", { max: PRICE_MAX })}
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
            {mode === "islamic" ? t("profitRate") : t("interestRate")}
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
              <span id="rate-error">{t("rateRangeError", { max: RATE_MAX })}</span>
            </FieldError>
          )}
        </div>
        <div>
          <Label htmlFor="years">{t("years")}</Label>
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
                {t("yearsRangeError", { min: YEARS_MIN, max: YEARS_MAX })}
              </span>
            </FieldError>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-stone-900">
          {tc("results")}
        </h2>
        <dl className="mt-4 space-y-4">
          <div>
            <CardTitle>{t("monthlyPayment")}</CardTitle>
            <dd className="text-3xl font-bold text-teal-800">
              {formatOMR(m.monthlyPayment, locale)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4 text-sm">
            <div>
              <dt className="text-xs text-stone-500">{t("loanAmount")}</dt>
              <dd className="font-semibold">
                {formatOMRWhole(m.loanAmount, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{t("totalPaid")}</dt>
              <dd className="font-semibold">
                {formatOMRWhole(m.totalPaid, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">
                {mode === "islamic" ? t("totalProfit") : t("totalInterest")}
              </dt>
              <dd className="font-semibold">
                {formatOMRWhole(m.totalCharge, locale)}
              </dd>
            </div>
          </div>
        </dl>
        {chartData.length > 1 && (
          <div className="mt-6">
            <CardTitle>{t("amortization")}</CardTitle>
            <div className="mt-2">
              <TrendChart
                data={chartData}
                series={[{ key: "balance", name: t("amortization") }]}
                height={200}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
