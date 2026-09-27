// Hand-checked math tests. Run with: npm test
import { rentalYield } from "./rentalYield";
import { mortgage } from "./mortgage";
import { roi } from "./roi";
import { investmentScore } from "./investmentScore";

let failures = 0;

function expectClose(label: string, actual: number, expected: number, tol = 0.01) {
  if (Math.abs(actual - expected) > tol) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual.toFixed(3)}`);
  }
}

// Rental yield: 100k purchase, 500/mo rent, 1k expenses
// annual rent 6000 → gross 6%; net 5000 → 5%
{
  const r = rentalYield({ purchasePrice: 100_000, monthlyRent: 500, annualExpenses: 1_000 });
  expectClose("rentalYield.annualRent", r.annualRent, 6_000);
  expectClose("rentalYield.grossYieldPct", r.grossYieldPct, 6);
  expectClose("rentalYield.netYieldPct", r.netYieldPct, 5);
}

// Mortgage: 100k loan (125k price, 25k down) @ 5% / 25y → 584.59/mo (standard amortization result)
{
  const m = mortgage({ propertyPrice: 125_000, downPayment: 25_000, annualRatePct: 5, years: 25, mode: "conventional" });
  expectClose("mortgage.loanAmount", m.loanAmount, 100_000);
  expectClose("mortgage.monthlyPayment", m.monthlyPayment, 584.59, 0.01);
  expectClose("mortgage.finalBalance", m.schedule.at(-1)!.balance, 0, 0.01);
}

// Zero-rate mortgage: 60k over 10y → 500/mo exactly
{
  const m = mortgage({ propertyPrice: 60_000, downPayment: 0, annualRatePct: 0, years: 10, mode: "islamic" });
  expectClose("mortgage.zeroRate.monthlyPayment", m.monthlyPayment, 500);
  expectClose("mortgage.zeroRate.totalCharge", m.totalCharge, 0);
}

// A huge/malformed "years" must never loop unbounded — the amortization
// loop is capped, so this must return instantly with finite numbers and a
// bounded schedule, regardless of what the UI is supposed to have validated.
{
  const started = Date.now();
  const m = mortgage({ propertyPrice: 100_000, downPayment: 0, annualRatePct: 5, years: 999_999_999, mode: "conventional" });
  const elapsedMs = Date.now() - started;
  if (elapsedMs > 500) {
    console.error(`FAIL mortgage.hugeYears.tooSlow: took ${elapsedMs}ms`);
    failures++;
  } else {
    console.log(`ok   mortgage.hugeYears.tooSlow < 500ms (${elapsedMs}ms)`);
  }
  if (!Number.isFinite(m.monthlyPayment) || m.schedule.length > 100) {
    console.error("FAIL mortgage.hugeYears.bounded");
    failures++;
  } else {
    console.log("ok   mortgage.hugeYears.bounded");
  }
}

// Negative/NaN "years" must not throw or loop — treated as zero.
{
  const m = mortgage({ propertyPrice: 100_000, downPayment: 0, annualRatePct: 5, years: NaN, mode: "conventional" });
  expectClose("mortgage.nanYears.monthlyPayment", m.monthlyPayment, 0);
  expectClose("mortgage.nanYears.scheduleLength", m.schedule.length, 0);
}

// An extreme property price or rate must never produce an unreadable,
// layout-breaking result (a monthly payment hundreds of digits long) — both
// are clamped to sane ceilings inside the pure function as a defensive
// second line behind the form's own validation.
{
  const m = mortgage({
    propertyPrice: 999_999_999_999,
    downPayment: 0,
    annualRatePct: 999_999,
    years: 25,
    mode: "conventional",
  });
  const digits = Math.round(m.monthlyPayment).toString().length;
  if (!Number.isFinite(m.monthlyPayment) || digits > 12) {
    console.error(`FAIL mortgage.extremePriceAndRate.bounded: monthlyPayment had ${digits} digits`);
    failures++;
  } else {
    console.log(`ok   mortgage.extremePriceAndRate.bounded (${digits} digits)`);
  }
}

// A merely huge (not absurd) property price with a normal rate still clamps
// to the ceiling rather than passing straight through.
{
  const capped = mortgage({ propertyPrice: 50_000_000, downPayment: 0, annualRatePct: 5, years: 25, mode: "conventional" });
  const atCeiling = mortgage({ propertyPrice: 10_000_000, downPayment: 0, annualRatePct: 5, years: 25, mode: "conventional" });
  expectClose("mortgage.priceClampedToCeiling", capped.loanAmount, atCeiling.loanAmount, 0.01);
}

// ROI: 100k cash purchase (no financing), rent 600, expenses 100 → cash flow 500/mo,
// 6000/yr, cash-on-cash 6%, break-even 200 months, 2%/yr growth over 10y
{
  const r = roi({
    purchasePrice: 100_000, downPayment: 0, monthlyRent: 600,
    monthlyExpenses: 100, monthlyMortgage: 0, annualAppreciationPct: 2, horizonYears: 10,
  });
  expectClose("roi.monthlyCashFlow", r.monthlyCashFlow, 500);
  expectClose("roi.cashOnCashPct", r.cashOnCashPct, 6);
  expectClose("roi.breakEvenMonths", r.breakEvenMonths ?? -1, 200);
  // 100k * 1.02^10 = 121,899.44 → gain 21,899.44; + cash flow 60,000
  expectClose("roi.totalReturn", r.totalReturn, 81_899.44, 0.5);
}

// Negative cash flow never breaks even
{
  const r = roi({
    purchasePrice: 100_000, downPayment: 20_000, monthlyRent: 400,
    monthlyExpenses: 100, monthlyMortgage: 450, annualAppreciationPct: 0, horizonYears: 5,
  });
  if (r.breakEvenMonths !== null) {
    console.error("FAIL roi.neverBreaksEven: expected null");
    failures++;
  } else {
    console.log("ok   roi.neverBreaksEven = null");
  }
}

// A huge/malformed "horizonYears" must never loop unbounded — capped, so
// this must return instantly with a bounded yearly-projection array.
{
  const started = Date.now();
  const r = roi({
    purchasePrice: 100_000, downPayment: 20_000, monthlyRent: 600,
    monthlyExpenses: 100, monthlyMortgage: 0, annualAppreciationPct: 2, horizonYears: 999_999_999,
  });
  const elapsedMs = Date.now() - started;
  if (elapsedMs > 500) {
    console.error(`FAIL roi.hugeHorizon.tooSlow: took ${elapsedMs}ms`);
    failures++;
  } else {
    console.log(`ok   roi.hugeHorizon.tooSlow < 500ms (${elapsedMs}ms)`);
  }
  if (!Number.isFinite(r.totalReturn) || r.yearly.length > 100) {
    console.error("FAIL roi.hugeHorizon.bounded");
    failures++;
  } else {
    console.log("ok   roi.hugeHorizon.bounded");
  }
}

// Investment score: no yield → insufficient data
{
  const r = investmentScore({ grossYieldPct: null, confidence: 0.8, dataAgeMonths: 0 });
  if (r.band !== "INSUFFICIENT_DATA" || r.score !== null) {
    console.error("FAIL investmentScore.insufficientData");
    failures++;
  } else {
    console.log("ok   investmentScore.insufficientData");
  }
}

// Strong: 7% yield, 0.8 confidence, fresh data
// yield 87.5*0.6=52.5 + conf 80*0.25=20 + recency 100*0.15=15 → 88 STRONG
{
  const r = investmentScore({ grossYieldPct: 7, confidence: 0.8, dataAgeMonths: null });
  expectClose("investmentScore.strong", r.score ?? -1, 88);
  if (r.band !== "STRONG") { console.error("FAIL investmentScore.strong.band"); failures++; }
}

// Weak: 2% yield, 0.3 confidence, 24-month-old data
// yield 25*0.6=15 + conf 30*0.25=7.5 + recency 4*0.15=0.6 → 23 WEAK
{
  const r = investmentScore({ grossYieldPct: 2, confidence: 0.3, dataAgeMonths: 24 });
  expectClose("investmentScore.weak", r.score ?? -1, 23);
  if (r.band !== "WEAK") { console.error("FAIL investmentScore.weak.band"); failures++; }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll calculator tests passed.");
