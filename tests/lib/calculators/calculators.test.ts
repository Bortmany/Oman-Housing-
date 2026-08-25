// Hand-checked math tests.
import { describe, expect, test } from "vitest";
import { rentalYield } from "@/lib/calculators/rentalYield";
import { mortgage } from "@/lib/calculators/mortgage";
import { roi } from "@/lib/calculators/roi";
import { investmentScore } from "@/lib/calculators/investmentScore";

function expectClose(actual: number, expected: number, tol = 0.01) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
}

describe("rentalYield", () => {
  // 100k purchase, 500/mo rent, 1k expenses
  // annual rent 6000 → gross 6%; net 5000 → 5%
  test("annual rent, gross yield, net yield", () => {
    const r = rentalYield({ purchasePrice: 100_000, monthlyRent: 500, annualExpenses: 1_000 });
    expectClose(r.annualRent, 6_000);
    expectClose(r.grossYieldPct, 6);
    expectClose(r.netYieldPct, 5);
  });
});

describe("mortgage", () => {
  // 100k loan (125k price, 25k down) @ 5% / 25y → 584.59/mo (standard amortization result)
  test("standard amortization result", () => {
    const m = mortgage({ propertyPrice: 125_000, downPayment: 25_000, annualRatePct: 5, years: 25, mode: "conventional" });
    expectClose(m.loanAmount, 100_000);
    expectClose(m.monthlyPayment, 584.59, 0.01);
    expectClose(m.schedule.at(-1)!.balance, 0, 0.01);
  });

  // Zero-rate mortgage: 60k over 10y → 500/mo exactly
  test("zero-rate mortgage", () => {
    const m = mortgage({ propertyPrice: 60_000, downPayment: 0, annualRatePct: 0, years: 10, mode: "islamic" });
    expectClose(m.monthlyPayment, 500);
    expectClose(m.totalCharge, 0);
  });

  // A huge/malformed "years" must never loop unbounded — the amortization
  // loop is capped, so this must return instantly with finite numbers and a
  // bounded schedule, regardless of what the UI is supposed to have validated.
  test("huge years never loops unbounded", () => {
    const started = Date.now();
    const m = mortgage({ propertyPrice: 100_000, downPayment: 0, annualRatePct: 5, years: 999_999_999, mode: "conventional" });
    const elapsedMs = Date.now() - started;
    expect(elapsedMs).toBeLessThanOrEqual(500);
    expect(Number.isFinite(m.monthlyPayment)).toBe(true);
    expect(m.schedule.length).toBeLessThanOrEqual(100);
  });

  // Negative/NaN "years" must not throw or loop — treated as zero.
  test("NaN years treated as zero", () => {
    const m = mortgage({ propertyPrice: 100_000, downPayment: 0, annualRatePct: 5, years: NaN, mode: "conventional" });
    expectClose(m.monthlyPayment, 0);
    expectClose(m.schedule.length, 0);
  });

  // An extreme property price or rate must never produce an unreadable,
  // layout-breaking result (a monthly payment hundreds of digits long) — both
  // are clamped to sane ceilings inside the pure function as a defensive
  // second line behind the form's own validation.
  test("extreme price and rate stay bounded", () => {
    const m = mortgage({
      propertyPrice: 999_999_999_999,
      downPayment: 0,
      annualRatePct: 999_999,
      years: 25,
      mode: "conventional",
    });
    const digits = Math.round(m.monthlyPayment).toString().length;
    expect(Number.isFinite(m.monthlyPayment)).toBe(true);
    expect(digits).toBeLessThanOrEqual(12);
  });

  // A merely huge (not absurd) property price with a normal rate still clamps
  // to the ceiling rather than passing straight through.
  test("huge price clamps to the same ceiling", () => {
    const capped = mortgage({ propertyPrice: 50_000_000, downPayment: 0, annualRatePct: 5, years: 25, mode: "conventional" });
    const atCeiling = mortgage({ propertyPrice: 10_000_000, downPayment: 0, annualRatePct: 5, years: 25, mode: "conventional" });
    expectClose(capped.loanAmount, atCeiling.loanAmount, 0.01);
  });
});

describe("roi", () => {
  // 100k cash purchase (no financing), rent 600, expenses 100 → cash flow 500/mo,
  // 6000/yr, cash-on-cash 6%, break-even 200 months, 2%/yr growth over 10y
  test("cash purchase cash flow and return", () => {
    const r = roi({
      purchasePrice: 100_000, downPayment: 0, monthlyRent: 600,
      monthlyExpenses: 100, monthlyMortgage: 0, annualAppreciationPct: 2, horizonYears: 10,
    });
    expectClose(r.monthlyCashFlow, 500);
    expectClose(r.cashOnCashPct, 6);
    expectClose(r.breakEvenMonths ?? -1, 200);
    // 100k * 1.02^10 = 121,899.44 → gain 21,899.44; + cash flow 60,000
    expectClose(r.totalReturn, 81_899.44, 0.5);
  });

  // Negative cash flow never breaks even
  test("negative cash flow never breaks even", () => {
    const r = roi({
      purchasePrice: 100_000, downPayment: 20_000, monthlyRent: 400,
      monthlyExpenses: 100, monthlyMortgage: 450, annualAppreciationPct: 0, horizonYears: 5,
    });
    expect(r.breakEvenMonths).toBeNull();
  });

  // A huge/malformed "horizonYears" must never loop unbounded — capped, so
  // this must return instantly with a bounded yearly-projection array.
  test("huge horizon never loops unbounded", () => {
    const started = Date.now();
    const r = roi({
      purchasePrice: 100_000, downPayment: 20_000, monthlyRent: 600,
      monthlyExpenses: 100, monthlyMortgage: 0, annualAppreciationPct: 2, horizonYears: 999_999_999,
    });
    const elapsedMs = Date.now() - started;
    expect(elapsedMs).toBeLessThanOrEqual(500);
    expect(Number.isFinite(r.totalReturn)).toBe(true);
    expect(r.yearly.length).toBeLessThanOrEqual(100);
  });
});

describe("investmentScore", () => {
  // no yield → insufficient data
  test("no yield is insufficient data", () => {
    const r = investmentScore({ grossYieldPct: null, confidence: 0.8, dataAgeMonths: 0 });
    expect(r.band).toBe("INSUFFICIENT_DATA");
    expect(r.score).toBeNull();
  });

  // Strong: 7% yield, 0.8 confidence, fresh data
  // yield 87.5*0.6=52.5 + conf 80*0.25=20 + recency 100*0.15=15 → 88 STRONG
  test("strong band", () => {
    const r = investmentScore({ grossYieldPct: 7, confidence: 0.8, dataAgeMonths: null });
    expectClose(r.score ?? -1, 88);
    expect(r.band).toBe("STRONG");
  });

  // Weak: 2% yield, 0.3 confidence, 24-month-old data
  // yield 25*0.6=15 + conf 30*0.25=7.5 + recency 4*0.15=0.6 → 23 WEAK
  test("weak band", () => {
    const r = investmentScore({ grossYieldPct: 2, confidence: 0.3, dataAgeMonths: 24 });
    expectClose(r.score ?? -1, 23);
    expect(r.band).toBe("WEAK");
  });
});
