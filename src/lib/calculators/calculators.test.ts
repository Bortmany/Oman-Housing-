// Hand-checked math tests. Run with: npm test
import { rentalYield } from "./rentalYield";
import { mortgage } from "./mortgage";
import { roi } from "./roi";
import { investmentScore } from "./investmentScore";
import { affordability, DBR_CAP } from "./affordability";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  areaRentPerSqm,
  chooseYieldRent,
  derivedConfidence,
  expectedRentForArea,
  monthlyListedRent,
  DERIVED_CONFIDENCE_CAP,
} from "./rentEstimate";
import {
  workOutPropertyFinancials,
  type Figure,
  type PropertyFinancialsInput,
} from "./propertyFinancials";

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

// Affordability: 2,000/mo income, 300/mo existing commitments, 60% DBR
// → 2,000*0.6 - 300 = 900/mo for the home. At 5% over 25 years that borrows
// 153,954.042 (the mortgage formula turned around — 900/584.59 * 100,000),
// plus 30,000 down = a 183,954.042 price ceiling.
{
  const a = affordability({
    monthlyIncome: 2_000, monthlyObligations: 300, downPayment: 30_000,
    annualRatePct: 5, years: 25, mode: "conventional",
  });
  expectClose("affordability.maxMonthlyPayment", a.maxMonthlyPayment, 900);
  expectClose("affordability.maxLoan", a.maxLoan, 153_954.042, 0.01);
  expectClose("affordability.maxPropertyPrice", a.maxPropertyPrice, 183_954.042, 0.01);
  expectClose("affordability.dbrCapPct", a.dbrCapPct, DBR_CAP * 100);
}

// Zero-rate (or profit-free) financing: 1,000/mo income, nothing owed
// → 600/mo for 10 years borrows exactly 72,000, and charges nothing extra.
{
  const a = affordability({
    monthlyIncome: 1_000, monthlyObligations: 0, downPayment: 10_000,
    annualRatePct: 0, years: 10, mode: "islamic",
  });
  expectClose("affordability.zeroRate.maxLoan", a.maxLoan, 72_000);
  expectClose("affordability.zeroRate.maxPropertyPrice", a.maxPropertyPrice, 82_000);
  expectClose("affordability.zeroRate.totalCharge", a.totalCharge, 0);
}

// Already committed past the cap: nothing is affordable, and the answer is
// zeros (never a negative price) — only the money already saved remains.
{
  const a = affordability({
    monthlyIncome: 1_000, monthlyObligations: 900, downPayment: 5_000,
    annualRatePct: 5, years: 20, mode: "conventional",
  });
  expectClose("affordability.overCommitted.maxMonthlyPayment", a.maxMonthlyPayment, 0);
  expectClose("affordability.overCommitted.maxLoan", a.maxLoan, 0);
  expectClose("affordability.overCommitted.maxPropertyPrice", a.maxPropertyPrice, 5_000);
}

// At the loan ceiling: 1,000,000/mo income could "afford" far more than the
// 10,000,000 cap, so the loan is capped. Total paid must use the repayment the
// capped loan actually needs (at 0% over 10 years: 10,000,000 / 120 per month),
// so it equals the loan exactly and nothing is charged on top.
{
  const a = affordability({
    monthlyIncome: 1_000_000, monthlyObligations: 0, downPayment: 0,
    annualRatePct: 0, years: 10, mode: "islamic",
  });
  expectClose("affordability.ceiling.maxLoan", a.maxLoan, 10_000_000);
  expectClose("affordability.ceiling.totalPaid", a.totalPaid, 10_000_000);
  expectClose("affordability.ceiling.totalCharge", a.totalCharge, 0);
}

// Same ceiling with a 5% rate over 25 years: the capped loan's repayment is
// 10,000,000 / 100,000 * 584.590 ≈ 58,459.004/mo, so over 300 months the bank
// is paid 17,537,701.245 and the charge is 7,537,701.245.
{
  const a = affordability({
    monthlyIncome: 1_000_000, monthlyObligations: 0, downPayment: 0,
    annualRatePct: 5, years: 25, mode: "conventional",
  });
  expectClose("affordability.ceilingRate.maxLoan", a.maxLoan, 10_000_000);
  expectClose("affordability.ceilingRate.totalPaid", a.totalPaid, 17_537_701.245, 0.01);
  expectClose("affordability.ceilingRate.totalCharge", a.totalCharge, 7_537_701.245, 0.01);
}

// Malformed input must never produce Infinity/NaN or an unusable figure.
{
  const a = affordability({
    monthlyIncome: Number.POSITIVE_INFINITY, monthlyObligations: -50,
    downPayment: -10, annualRatePct: 999, years: 999_999_999,
    mode: "conventional",
  });
  const finite =
    Number.isFinite(a.maxMonthlyPayment) &&
    Number.isFinite(a.maxLoan) &&
    a.maxPropertyPrice <= 10_000_000;
  if (!finite) {
    console.error("FAIL affordability.malformedInput.bounded");
    failures++;
  } else {
    console.log("ok   affordability.malformedInput.bounded");
  }
}

// ---------------------------------------------------------------------------
// Honest listing numbers (align-1, Build B): rent per property, yield basis.
// ---------------------------------------------------------------------------

function expectTrue(label: string, cond: boolean) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

// Seeded Al Mouj apartments (June 2026): rent 650, sale 120,000, 1,142.857/sqm.
const NOW = new Date("2026-07-15T00:00:00Z");
const alMoujApt = {
  avgRentMonthly: 650,
  avgPricePerSqm: 1_142.857,
  avgSalePrice: 120_000,
  confidence: 0.6,
  isSample: false,
  periodStart: new Date("2026-06-01T00:00:00Z"),
};
function input(over: Partial<PropertyFinancialsInput>): PropertyFinancialsInput {
  return { floorAreaSqm: null, propertyIsSample: false, valuation: null, comp: alMoujApt, rentListing: null, now: NOW, ...over };
}

// Rent per sqm = 650 x 1,142.857 / 120,000 ≈ 6.190; rent scales with floor area.
{
  const rps = areaRentPerSqm(alMoujApt)!;
  expectClose("rentEstimate.alMouj.rentPerSqm", rps, 6.190, 0.001);
  const small = expectedRentForArea(75, rps)!;
  const big = expectedRentForArea(110, rps)!;
  expectClose("rentEstimate.alMouj.75sqm", small, 464.29, 0.5);
  expectClose("rentEstimate.alMouj.110sqm", big, 680.95, 0.5);
  expectTrue("rentEstimate.scalesWithFloorArea (75 < 110)", small < big);
}

// Missing or non-positive area figures ⇒ no rent per sqm; no floor area ⇒ no rent.
{
  expectTrue("rentEstimate.missingRent.null", areaRentPerSqm({ ...alMoujApt, avgRentMonthly: null }) === null);
  expectTrue("rentEstimate.missingPricePerSqm.null", areaRentPerSqm({ ...alMoujApt, avgPricePerSqm: null }) === null);
  expectTrue("rentEstimate.zeroSalePrice.null", areaRentPerSqm({ ...alMoujApt, avgSalePrice: 0 }) === null);
  expectTrue("rentEstimate.noFloorArea.null", expectedRentForArea(null, 6.19) === null);
  expectTrue("rentEstimate.zeroFloorArea.null", expectedRentForArea(0, 6.19) === null);
}

// Annual asking rent is divided by 12; monthly stays as is.
{
  expectClose("rentEstimate.annualToMonthly", monthlyListedRent(24_000, "ANNUAL"), 2_000);
  expectClose("rentEstimate.monthlyUnchanged", monthlyListedRent(650, "MONTHLY"), 650);
}

// Asking beats estimate; estimate when no asking; none when neither.
{
  const a = chooseYieldRent({ askingMonthly: 2_140, estimateMonthly: 2_147 });
  expectTrue("chooseYieldRent.askingWins", a.basis === "ASKING" && a.monthlyRent === 2_140);
  const e = chooseYieldRent({ askingMonthly: null, estimateMonthly: 464 });
  expectTrue("chooseYieldRent.estimateWhenNoAsking", e.basis === "ESTIMATE" && e.monthlyRent === 464);
  const n = chooseYieldRent({ askingMonthly: null, estimateMonthly: null });
  expectTrue("chooseYieldRent.none", n.basis === "NONE" && n.monthlyRent === null);
}

// Confidence cap.
{
  expectClose("derivedConfidence.capped", derivedConfidence(0.9, 0.95), DERIVED_CONFIDENCE_CAP);
  expectClose("derivedConfidence.weakestWins", derivedConfidence(0.9, 0.3), 0.3);
}

// A derived figure is never VERIFIED/OFFICIAL_STAT and never above 0.5
// confidence, even when every input is verified with high confidence.
function derivedFigures(f: ReturnType<typeof workOutPropertyFinancials>): Figure[] {
  // listedRent is the listing's own stored figure and a STORED valuation is
  // its own record; everything else here is worked out.
  return [
    f.estimatedValueBasis === "STORED" ? null : f.estimatedValue,
    f.pricePerSqm, f.expectedRent, f.grossYieldPct,
  ].filter((x): x is Figure => x != null);
}
{
  const f = workOutPropertyFinancials(input({
    floorAreaSqm: 110,
    comp: { ...alMoujApt, confidence: 0.95 },
    valuation: { valueMid: 130_000, provenance: "VERIFIED", confidence: 0.95, assumptions: null, isSample: false },
    rentListing: { price: 700, rentPeriod: "MONTHLY", provenance: "VERIFIED", confidence: 0.95, isSample: false },
  }));
  const all = derivedFigures(f);
  expectTrue("derived.count (value stored, so 3 derived)", all.length === 3);
  expectTrue("derived.neverVerifiedOrOfficial",
    all.every((x) => x.provenance !== "VERIFIED" && x.provenance !== "OFFICIAL_STAT"));
  expectTrue("derived.confidenceCapped", all.every((x) => x.confidence <= DERIVED_CONFIDENCE_CAP));
  expectTrue("derived.scoreConfidenceCapped", (f.investmentConfidence ?? 1) <= DERIVED_CONFIDENCE_CAP);
}

// Seeded scenario: Al Mouj 75 sqm and 110 sqm flats, no stored valuation, no
// rent listing. Different expected rents (≈464 / ≈681), same yield (≈6.5%).
{
  const small = workOutPropertyFinancials(input({ floorAreaSqm: 75 }));
  const big = workOutPropertyFinancials(input({ floorAreaSqm: 110 }));
  expectClose("financials.alMouj75.expectedRent", small.expectedRent!.value, 464.29, 0.5);
  expectClose("financials.alMouj110.expectedRent", big.expectedRent!.value, 680.95, 0.5);
  expectTrue("financials.alMouj.basisThisProperty",
    small.expectedRentBasis === "THIS_PROPERTY" && big.expectedRentBasis === "THIS_PROPERTY");
  expectClose("financials.alMouj75.yield", small.grossYieldPct!.value, 6.5, 0.05);
  expectClose("financials.alMouj110.yield", big.grossYieldPct!.value, 6.5, 0.05);
  expectTrue("financials.alMouj.yieldBasisEstimate", small.yieldBasis === "ESTIMATE" && big.yieldBasis === "ESTIMATE");
  expectClose("financials.alMouj75.rentUsed", small.yieldRentUsed!, 464.29, 0.5);
  expectTrue("financials.alMouj.sameScore", small.investment.score === big.investment.score);
}

// Seeded scenario: the rental villa. Asking 2,140/month, value
// 1,255.285 x 380 ≈ 477,008 ⇒ yield ≈ 5.4%.
{
  const villaComp = {
    // Area figures chosen so the estimate is ≈ 2,147 (rent per sqm ≈ 5.65).
    avgRentMonthly: 2_000, avgPricePerSqm: 1_255.285, avgSalePrice: 444_344,
    confidence: 0.6, isSample: false, periodStart: new Date("2026-06-01T00:00:00Z"),
  };
  const f = workOutPropertyFinancials(input({
    floorAreaSqm: 380,
    comp: villaComp,
    rentListing: { price: 2_140, rentPeriod: "MONTHLY", provenance: "USER_SUBMITTED", confidence: 0.7, isSample: false },
  }));
  expectClose("financials.villa.estimatedValue", f.estimatedValue!.value, 477_008.3, 1);
  expectClose("financials.villa.yield", f.grossYieldPct!.value, 5.38, 0.02);
  expectTrue("financials.villa.basisAsking", f.yieldBasis === "ASKING" && f.yieldRentUsed === 2_140);
  expectClose("financials.villa.estimateStillShown", f.expectedRent!.value, 2_147, 1);
}

// Annual asking rent: 24,000 a year ⇒ 2,000 a month used for the yield, flagged.
{
  const f = workOutPropertyFinancials(input({
    floorAreaSqm: 110,
    rentListing: { price: 24_000, rentPeriod: "ANNUAL", provenance: "USER_SUBMITTED", confidence: 0.7, isSample: false },
  }));
  expectClose("financials.annual.listedRentPerMonth", f.listedRent!.value, 2_000);
  expectTrue("financials.annual.flagged", f.listedRentAnnual === 24_000);
  expectTrue("financials.annual.yieldUsesMonthly", f.yieldBasis === "ASKING" && f.yieldRentUsed === 2_000);
  expectClose("financials.annual.yield", f.grossYieldPct!.value, ((2_000 * 12) / (1_142.857 * 110)) * 100, 0.01);
}

// No floor area, no stored valuation: value and rent are area averages,
// labelled so, and there is NO yield and NO score (never a wrong one).
{
  const f = workOutPropertyFinancials(input({ floorAreaSqm: null }));
  expectTrue("financials.noArea.valueAreaAverage", f.estimatedValueBasis === "AREA_AVERAGE");
  expectTrue("financials.noArea.rentAreaAverage", f.expectedRentBasis === "AREA_AVERAGE");
  expectTrue("financials.noArea.noYield", f.grossYieldPct === null && f.yieldBasis === "NONE");
  expectTrue("financials.noArea.noScore",
    f.investment.score === null && f.investment.band === "INSUFFICIENT_DATA");
}

// No floor area but an advertised rent: the value is only an area average,
// so still no yield.
{
  const f = workOutPropertyFinancials(input({
    floorAreaSqm: null,
    rentListing: { price: 650, rentPeriod: "MONTHLY", provenance: "USER_SUBMITTED", confidence: 0.7, isSample: false },
  }));
  expectTrue("financials.noAreaWithAsking.noYield", f.grossYieldPct === null && f.investment.score === null);
}

// Area figures lacking numbers (a real official row with only the rent): no
// per-property rent, no value, no yield, no score.
{
  const f = workOutPropertyFinancials(input({
    floorAreaSqm: 110,
    comp: { ...alMoujApt, avgPricePerSqm: null, avgSalePrice: null },
  }));
  expectTrue("financials.missingAreaFigures.rentIsAreaAverage", f.expectedRentBasis === "AREA_AVERAGE");
  expectTrue("financials.missingAreaFigures.noRentPerSqm", f.rentPerSqm === null);
  expectTrue("financials.missingAreaFigures.noYield", f.grossYieldPct === null);
  expectTrue("financials.missingAreaFigures.noScore", f.investment.score === null);
}

// Stored valuation but no floor area and no asking rent: the rent is only an
// area average ⇒ no yield.
{
  const f = workOutPropertyFinancials(input({
    floorAreaSqm: null,
    valuation: { valueMid: 130_000, provenance: "AI_ESTIMATED", confidence: 0.4, assumptions: null, isSample: false },
  }));
  expectTrue("financials.storedValueNoArea.noYield", f.grossYieldPct === null && f.investment.score === null);
}

// Sample in ⇒ sample out; all-real in ⇒ not sample.
{
  const sampleComp = workOutPropertyFinancials(input({ floorAreaSqm: 75, comp: { ...alMoujApt, isSample: true } }));
  expectTrue("financials.sampleComp.allDerivedSample",
    derivedFigures(sampleComp).every((x) => x.isSample) && sampleComp.investmentIsSample);

  const sampleListing = workOutPropertyFinancials(input({
    floorAreaSqm: 110,
    rentListing: { price: 700, rentPeriod: "MONTHLY", provenance: "USER_SUBMITTED", confidence: 0.7, isSample: true },
  }));
  expectTrue("financials.sampleListing.yieldSample", sampleListing.grossYieldPct!.isSample === true);
  expectTrue("financials.sampleListing.scoreSample", sampleListing.investmentIsSample === true);
  expectTrue("financials.sampleListing.estimateNotSample", sampleListing.expectedRent!.isSample === false);

  const sampleValuation = workOutPropertyFinancials(input({
    floorAreaSqm: 110,
    valuation: { valueMid: 130_000, provenance: "AI_ESTIMATED", confidence: 0.4, assumptions: null, isSample: true },
  }));
  expectTrue("financials.sampleValuation.yieldSample", sampleValuation.grossYieldPct!.isSample === true);

  const real = workOutPropertyFinancials(input({ floorAreaSqm: 110 }));
  expectTrue("financials.allReal.notSample",
    derivedFigures(real).every((x) => !x.isSample) && !real.investmentIsSample);
}

// A sample home's own (invented) floor area makes every figure built from it
// sample, even once a REAL market figure exists for its area and type — the
// still-public sample flats must never show "AI estimated 50%".
{
  const f = workOutPropertyFinancials(input({ floorAreaSqm: 75, propertyIsSample: true }));
  expectTrue("financials.sampleHomeRealStat.valueSample",
    f.estimatedValueBasis === "THIS_PROPERTY" && f.estimatedValue!.isSample === true);
  expectTrue("financials.sampleHomeRealStat.pricePerSqmSample", f.pricePerSqm!.isSample === true);
  expectTrue("financials.sampleHomeRealStat.rentSample",
    f.expectedRentBasis === "THIS_PROPERTY" && f.expectedRent!.isSample === true);
  expectTrue("financials.sampleHomeRealStat.yieldSample", f.grossYieldPct!.isSample === true);
  expectTrue("financials.sampleHomeRealStat.scoreSample",
    f.investment.score != null && f.investmentIsSample === true);

  // Same home with a real advertised rent and a real stored valuation: the
  // home is still invented, so the yield and score stay sample.
  const g = workOutPropertyFinancials(input({
    floorAreaSqm: 75, propertyIsSample: true,
    valuation: { valueMid: 90_000, provenance: "AI_ESTIMATED", confidence: 0.4, assumptions: null, isSample: false },
    rentListing: { price: 500, rentPeriod: "MONTHLY", provenance: "USER_SUBMITTED", confidence: 0.7, isSample: false },
  }));
  expectTrue("financials.sampleHomeRealInputs.valueSample", g.estimatedValue!.isSample === true);
  expectTrue("financials.sampleHomeRealInputs.yieldSample",
    g.yieldBasis === "ASKING" && g.grossYieldPct!.isSample === true && g.investmentIsSample === true);
}

// Converse: a real home + a real market figure ⇒ nothing is sample.
{
  const f = workOutPropertyFinancials(input({ floorAreaSqm: 75, propertyIsSample: false }));
  expectTrue("financials.realHomeRealStat.valueNotSample", f.estimatedValue!.isSample === false);
  expectTrue("financials.realHomeRealStat.pricePerSqmNotSample", f.pricePerSqm!.isSample === false);
  expectTrue("financials.realHomeRealStat.rentNotSample", f.expectedRent!.isSample === false);
  expectTrue("financials.realHomeRealStat.yieldNotSample", f.grossYieldPct!.isSample === false);
  expectTrue("financials.realHomeRealStat.scoreNotSample",
    f.investment.score != null && f.investmentIsSample === false);
}

// Regression: the property page and the compare cards get the same numbers.
// Both call the one `propertyFinancials` (which only reads rows and calls
// workOutPropertyFinancials) and hand the result straight to the same card.
{
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const page = read("src/app/[locale]/(public)/properties/[id]/page.tsx");
  const compare = read("src/app/[locale]/(public)/properties/compare/page.tsx");
  const valuations = read("src/lib/db/valuations.ts");
  for (const [name, src] of [["propertyPage", page], ["comparePage", compare]] as const) {
    expectTrue(`sharedFinancials.${name}.importsPropertyFinancials`,
      /import \{ propertyFinancials \} from "@\/lib\/db\/valuations"/.test(src));
    expectTrue(`sharedFinancials.${name}.rendersCardWithIt`,
      /<FinancialAnalysisCard financials=\{financials\} \/>/.test(src));
    expectTrue(`sharedFinancials.${name}.noOwnMaths`,
      !/rentalYield|investmentScore|workOutPropertyFinancials/.test(src));
  }
  expectTrue("sharedFinancials.valuationsCallsPureFunction",
    /workOutPropertyFinancials\(/.test(valuations) && !/rentalYield\(|investmentScore\(/.test(valuations));
  const a = workOutPropertyFinancials(input({ floorAreaSqm: 75 }));
  const b = workOutPropertyFinancials(input({ floorAreaSqm: 75 }));
  expectTrue("sharedFinancials.deterministic", JSON.stringify(a) === JSON.stringify(b));
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll calculator tests passed.");
