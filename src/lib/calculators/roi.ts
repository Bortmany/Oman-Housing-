// Pure functions — no UI, no I/O. Amounts in OMR.

export type RoiInput = {
  purchasePrice: number;
  downPayment: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyMortgage: number; // 0 for a cash purchase
  annualAppreciationPct: number;
  horizonYears: number;
};

export type RoiResult = {
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashPct: number; // annual cash flow / cash invested
  breakEvenMonths: number | null; // months until cumulative cash flow covers the down payment
  totalReturn: number; // cumulative cash flow + appreciation over the horizon
  yearly: Array<{ year: number; cumulativeCashFlow: number; propertyValue: number }>;
};

export function roi(input: RoiInput): RoiResult {
  const cashInvested = input.downPayment > 0 ? input.downPayment : input.purchasePrice;
  const monthlyCashFlow =
    input.monthlyRent - input.monthlyExpenses - input.monthlyMortgage;
  const annualCashFlow = monthlyCashFlow * 12;

  const breakEvenMonths =
    monthlyCashFlow > 0 ? Math.ceil(cashInvested / monthlyCashFlow) : null;

  const yearly: RoiResult["yearly"] = [];
  let value = input.purchasePrice;
  for (let y = 1; y <= input.horizonYears; y++) {
    value = value * (1 + input.annualAppreciationPct / 100);
    yearly.push({
      year: y,
      cumulativeCashFlow: annualCashFlow * y,
      propertyValue: value,
    });
  }

  const appreciationGain =
    (yearly.at(-1)?.propertyValue ?? input.purchasePrice) - input.purchasePrice;

  return {
    monthlyCashFlow,
    annualCashFlow,
    cashOnCashPct: cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0,
    breakEvenMonths,
    totalReturn: annualCashFlow * input.horizonYears + appreciationGain,
    yearly,
  };
}
