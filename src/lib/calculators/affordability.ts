// Pure functions — no UI, no I/O. Amounts in OMR.
//
// "How much house can I afford?" worked backwards from income instead of
// forwards from a price (that is mortgage.ts).
//
// The rule banks in Oman work to is a debt-burden ratio (DBR): the total of
// your monthly commitments may not pass a set share of your monthly income.
// We use 60%, the ceiling the Central Bank of Oman applies to housing finance
// — a starting point, not a promise, and the UI says so. Individual banks are
// often stricter, and they use their own definition of income.
//
// Financing type works exactly as in mortgage.ts: "islamic" is modeled as a
// fixed profit rate on a declining balance, which is the same arithmetic as a
// conventional rate — only the wording on screen changes.

import type { MortgageMode } from "./mortgage";

/** Share of monthly income that may go to all financing commitments. */
export const DBR_CAP = 0.6;

export type AffordabilityInput = {
  monthlyIncome: number;
  /** Existing monthly commitments: car finance, personal loan, credit cards. */
  monthlyObligations: number;
  downPayment: number;
  annualRatePct: number; // interest rate or profit rate
  years: number;
  mode: MortgageMode;
};

export type AffordabilityResult = {
  /** The most that may go to the new home each month, after the DBR rule. */
  maxMonthlyPayment: number;
  /** What that monthly payment can borrow over the term. */
  maxLoan: number;
  /** Borrowing plus the money down = the price to shop up to. */
  maxPropertyPrice: number;
  /** Everything paid to the bank over the full term. */
  totalPaid: number;
  /** Interest (or profit) inside that total. */
  totalCharge: number;
  /** The DBR ceiling used, as a percentage — for the on-screen explanation. */
  dbrCapPct: number;
};

// Defensive ceilings, the same reasoning as mortgage.ts: this is a pure
// function that any future caller can reach, so no input — pasted, malformed,
// or hostile — may produce an unbounded loop or a number hundreds of digits
// long that wrecks the results card.
const MAX_MONTHS = 100 * 12;
const MAX_MONTHLY_INCOME = 1_000_000; // OMR per month, far past any real salary
const MAX_ANNUAL_RATE_PCT = 30;
const MAX_PROPERTY_PRICE = 10_000_000;

function clamp(value: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
}

const EMPTY = (dbrCapPct: number): AffordabilityResult => ({
  maxMonthlyPayment: 0,
  maxLoan: 0,
  maxPropertyPrice: 0,
  totalPaid: 0,
  totalCharge: 0,
  dbrCapPct,
});

export function affordability(
  input: AffordabilityInput,
): AffordabilityResult {
  const dbrCapPct = Math.round(DBR_CAP * 100);
  const monthlyIncome = clamp(input.monthlyIncome, MAX_MONTHLY_INCOME);
  const monthlyObligations = clamp(input.monthlyObligations, MAX_MONTHLY_INCOME);
  const downPayment = clamp(input.downPayment, MAX_PROPERTY_PRICE);
  const annualRatePct = clamp(input.annualRatePct, MAX_ANNUAL_RATE_PCT);
  const months = Math.min(
    Math.round(clamp(input.years, MAX_MONTHS) * 12),
    MAX_MONTHS,
  );

  // What the DBR rule leaves for the home, after what is already committed.
  const maxMonthlyPayment = Math.max(
    monthlyIncome * DBR_CAP - monthlyObligations,
    0,
  );
  if (maxMonthlyPayment <= 0 || months <= 0) {
    return { ...EMPTY(dbrCapPct), maxPropertyPrice: downPayment };
  }

  // The borrowing that payment supports: the present value of paying it every
  // month for the whole term (the mortgage formula turned around).
  const r = annualRatePct / 100 / 12;
  const rawLoan =
    r === 0
      ? maxMonthlyPayment * months
      : (maxMonthlyPayment * (1 - Math.pow(1 + r, -months))) / r;
  const maxLoan = Math.min(rawLoan, MAX_PROPERTY_PRICE);

  const totalPaid = maxMonthlyPayment * months;
  return {
    maxMonthlyPayment,
    maxLoan,
    maxPropertyPrice: Math.min(maxLoan + downPayment, MAX_PROPERTY_PRICE),
    totalPaid,
    totalCharge: Math.max(totalPaid - maxLoan, 0),
    dbrCapPct,
  };
}
