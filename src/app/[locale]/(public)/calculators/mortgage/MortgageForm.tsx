"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { mortgage, type MortgageMode } from "@/lib/calculators/mortgage";
import { formatOMR, formatOMRWhole } from "@/lib/money";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Hint } from "@/components/ui/Field";
import { TrendChart } from "@/components/charts/TrendChart";

export function MortgageForm() {
  const t = useTranslations("calculators.mortgage");
  const tc = useTranslations("calculators");
  const locale = useLocale();

  const [mode, setMode] = useState<MortgageMode>("conventional");
  const [price, setPrice] = useState(120_000);
  const [down, setDown] = useState(24_000);
  const [rate, setRate] = useState(5.0);
  const [years, setYears] = useState(25);

  const m = mortgage({
    propertyPrice: price,
    downPayment: down,
    annualRatePct: rate,
    years,
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
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
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
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="years">{t("years")}</Label>
          <Input
            id="years"
            type="number"
            min={1}
            max={35}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
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
