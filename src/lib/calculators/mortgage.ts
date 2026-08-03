// Pure functions — no UI, no I/O. Amounts in OMR.
//
// "conventional": standard amortizing loan (interest on declining balance).
// "islamic": modeled as a fixed profit rate on a declining balance, the same
// math as diminishing musharaka with a constant payment. Actual bank
// structures (murabaha, ijara, musharaka) vary — the UI carries a disclaimer.

export type MortgageMode = "conventional" | "islamic";

export type MortgageInput = {
  propertyPrice: number;
  downPayment: number;
  annualRatePct: number; // interest rate or profit rate
  years: number;
  mode: MortgageMode;
};

export type MortgageResult = {
  loanAmount: number;
  monthlyPayment: number;
  totalPaid: number;
  totalCharge: number; // interest or profit over the term
  schedule: Array<{ month: number; balance: number }>; // yearly points for charting
};

// Hard ceiling on the amortization loop below. The mortgage form limits
// "years" to 1-35 and validates it before calling this function, but this
// pure function is a second, defensive line: no caller — malformed input,
// a future integration, a bug — can ever make it loop an unbounded number
// of times and freeze the browser tab.
const MAX_MONTHS = 100 * 12;

export function mortgage(input: MortgageInput): MortgageResult {
  const loanAmount = Math.max(input.propertyPrice - input.downPayment, 0);
  const requestedYears = Number.isFinite(input.years)
    ? Math.max(input.years, 0)
    : 0;
  const months = Math.min(Math.round(requestedYears * 12), MAX_MONTHS);
  if (loanAmount <= 0 || months <= 0) {
    return {
      loanAmount,
      monthlyPayment: 0,
      totalPaid: 0,
      totalCharge: 0,
      schedule: [],
    };
  }

  const r = input.annualRatePct / 100 / 12;
  const monthlyPayment =
    r === 0
      ? loanAmount / months
      : (loanAmount * r) / (1 - Math.pow(1 + r, -months));

  // Balance sampled every 12 months for the chart.
  const schedule: Array<{ month: number; balance: number }> = [];
  let balance = loanAmount;
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) - monthlyPayment;
    if (m % 12 === 0 || m === months) {
      schedule.push({ month: m, balance: Math.max(balance, 0) });
    }
  }

  const totalPaid = monthlyPayment * months;
  return {
    loanAmount,
    monthlyPayment,
    totalPaid,
    totalCharge: totalPaid - loanAmount,
    schedule,
  };
}
