"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { rentalYield } from "@/lib/calculators/rentalYield";
import { formatOMR, formatPercent } from "@/lib/money";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Hint } from "@/components/ui/Field";

export function RentalYieldForm() {
  const t = useTranslations("calculators.rentalYield");
  const tc = useTranslations("calculators");
  const locale = useLocale();

  const [price, setPrice] = useState(100_000);
  const [rent, setRent] = useState(550);
  const [expenses, setExpenses] = useState(800);

  const r = rentalYield({
    purchasePrice: price,
    monthlyRent: rent,
    annualExpenses: expenses,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="price">{t("purchasePrice")}</Label>
          <Input
            id="price"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="rent">{t("monthlyRent")}</Label>
          <Input
            id="rent"
            type="number"
            min={0}
            value={rent}
            onChange={(e) => setRent(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="expenses">{t("annualExpenses")}</Label>
          <Input
            id="expenses"
            type="number"
            min={0}
            value={expenses}
            onChange={(e) => setExpenses(Number(e.target.value))}
          />
          <Hint>{t("annualExpensesHint")}</Hint>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-stone-900">
          {tc("results")}
        </h2>
        <dl className="mt-4 space-y-4">
          <div>
            <CardTitle>{t("grossYield")}</CardTitle>
            <dd className="text-3xl font-bold text-teal-800">
              {formatPercent(r.grossYieldPct, locale)}
            </dd>
          </div>
          <div>
            <CardTitle>{t("netYield")}</CardTitle>
            <dd className="text-3xl font-bold text-stone-900">
              {formatPercent(r.netYieldPct, locale)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4 text-sm">
            <div>
              <dt className="text-xs text-stone-500">{t("annualRent")}</dt>
              <dd className="font-semibold">{formatOMR(r.annualRent, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{t("annualNet")}</dt>
              <dd className="font-semibold">{formatOMR(r.annualNet, locale)}</dd>
            </div>
          </div>
        </dl>
      </Card>
    </div>
  );
}
