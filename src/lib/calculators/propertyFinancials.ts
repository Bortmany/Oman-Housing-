// Pure function — no UI, no I/O. Amounts in OMR.
// The whole "Financial analysis" working for one property, from the rows
// valuations.ts has already read. valuations.ts only reads and calls this;
// the property page, the compare cards and the AI analyst all get their
// numbers from here (one calculation, one answer).
//
// Honesty rules (house rule 1):
// - every figure worked out here is AI_ESTIMATED, confidence capped at
//   DERIVED_CONFIDENCE_CAP — never VERIFIED or OFFICIAL_STAT;
// - anything worked out from a sample input is sample — and that includes
//   the home itself: a figure built from a sample home's (invented) floor
//   area is sample even when the area's market figure is real;
// - an area average is never passed off as this property's own figure, and
//   is left out of the yield and the score.
// Returns facts (bases, floor area, rent per sqm, rent used), never sentences,
// so the card can say them in either language.

import type { DataProvenance } from "@prisma/client";
import { anySample } from "@/lib/db/sampleData";
import { rentalYield } from "./rentalYield";
import { investmentScore, type InvestmentScoreResult } from "./investmentScore";
import {
  areaRentPerSqm,
  chooseYieldRent,
  derivedConfidence,
  expectedRentForArea,
  monthlyListedRent,
  type YieldRentBasis,
} from "./rentEstimate";

export type Figure = {
  value: number;
  provenance: DataProvenance;
  confidence: number;
  sourceNote: string | null;
  /** Invented demonstration data (or worked out from it): draws the Sample badge. */
  isSample: boolean;
};

/**
 * Why no yield could be worked out (null when there is one):
 * NO_FLOOR_AREA = this home's floor area is not recorded, so neither its own
 * value nor its own rent can be estimated; NO_AREA_FIGURES = the area's
 * market figures are missing or lack the numbers needed; NO_VALUE = there is
 * no usable value for this home (e.g. a stored valuation of zero).
 */
export type YieldMissingReason = "NO_FLOOR_AREA" | "NO_AREA_FIGURES" | "NO_VALUE";

/** STORED = a saved valuation; THIS_PROPERTY = worked out for this home; AREA_AVERAGE = the area's figure only. */
export type FigureBasis = "STORED" | "THIS_PROPERTY" | "AREA_AVERAGE";

export type PropertyFinancials = {
  estimatedValue: Figure | null;
  estimatedValueBasis: FigureBasis | null;
  pricePerSqm: Figure | null;
  /** Real asking rent from an ACTIVE rent listing, always per month. */
  listedRent: Figure | null;
  /** The advertised yearly amount when the listing was yearly (converted to per month above); else null. */
  listedRentAnnual: number | null;
  /** This property's floor area x the area's rent per sqm, or the area average (see basis). */
  expectedRent: Figure | null;
  expectedRentBasis: Exclude<FigureBasis, "STORED"> | null;
  /** The floor area the estimate used (null when none was recorded). */
  floorAreaSqm: number | null;
  /** The area's monthly rent per sqm (null when the area's figures lack a number). */
  rentPerSqm: number | null;
  grossYieldPct: Figure | null;
  /** Which rent the yield used: the advertised rent, the per-property estimate, or none. */
  yieldBasis: YieldRentBasis;
  /** The monthly rent the yield was worked out from (null when no yield). */
  yieldRentUsed: number | null;
  /** Why there is no yield (null when there is one), so the card can say the true reason. */
  yieldMissingReason: YieldMissingReason | null;
  investment: InvestmentScoreResult;
  investmentConfidence: number | null;
  /** True when the score was worked out from any sample input. */
  investmentIsSample: boolean;
};

export type PropertyFinancialsInput = {
  floorAreaSqm: number | null;
  /** The home itself is invented sample data (its floor area included). */
  propertyIsSample: boolean;
  /** The valuation to show (already chosen by preferRealValuation), or null. */
  valuation: {
    valueMid: number;
    provenance: DataProvenance;
    confidence: number;
    assumptions: string | null;
    isSample: boolean;
  } | null;
  /** Nearest market figure for the area and type (latest visible month), or null. */
  comp: {
    avgRentMonthly: number | null;
    avgPricePerSqm: number | null;
    avgSalePrice: number | null;
    confidence: number;
    isSample: boolean;
    periodStart: Date;
  } | null;
  /** The property's live rent listing, if any. */
  rentListing: {
    price: number;
    rentPeriod: "MONTHLY" | "ANNUAL" | null;
    provenance: DataProvenance;
    confidence: number;
    isSample: boolean;
  } | null;
  now: Date;
};

export const EMPTY_FINANCIALS: PropertyFinancials = {
  estimatedValue: null,
  estimatedValueBasis: null,
  pricePerSqm: null,
  listedRent: null,
  listedRentAnnual: null,
  expectedRent: null,
  expectedRentBasis: null,
  floorAreaSqm: null,
  rentPerSqm: null,
  grossYieldPct: null,
  yieldBasis: "NONE",
  yieldRentUsed: null,
  yieldMissingReason: "NO_VALUE",
  investment: { score: null, band: "INSUFFICIENT_DATA" },
  investmentConfidence: null,
  investmentIsSample: false,
};

function monthsBetween(from: Date, now: Date): number {
  return Math.max(
    0,
    Math.round((now.getTime() - from.getTime()) / (30 * 24 * 3600 * 1000)),
  );
}

export function workOutPropertyFinancials(
  input: PropertyFinancialsInput,
): PropertyFinancials {
  const { valuation, comp, rentListing, now } = input;
  const area =
    input.floorAreaSqm != null && input.floorAreaSqm > 0 ? input.floorAreaSqm : null;
  const compConfidence = comp ? derivedConfidence(comp.confidence) : 0;
  const compSample = comp?.isSample ?? false;
  const home = { isSample: input.propertyIsSample };
  // A figure built from this home's own data (floor area, its valuation) AND
  // the area's figure: sample if either is.
  const ownSample = anySample([home, comp]);

  // --- Estimated market value ---
  let estimatedValue: Figure | null = null;
  let estimatedValueBasis: FigureBasis | null = null;
  let dataAgeMonths: number | null = null;
  if (valuation) {
    estimatedValue = {
      value: valuation.valueMid,
      provenance: valuation.provenance,
      confidence: valuation.confidence,
      sourceNote: valuation.assumptions,
      isSample: anySample([valuation, home]),
    };
    estimatedValueBasis = "STORED";
    dataAgeMonths = null; // stored valuation counts as fresh
  } else if (comp) {
    const perSqm = comp.avgPricePerSqm;
    if (perSqm != null && perSqm > 0 && area != null) {
      estimatedValue = {
        value: perSqm * area,
        provenance: "AI_ESTIMATED",
        confidence: compConfidence,
        sourceNote:
          "Derived from neighborhood comparable data — not a stored valuation.",
        isSample: ownSample,
      };
      estimatedValueBasis = "THIS_PROPERTY";
      dataAgeMonths = monthsBetween(comp.periodStart, now);
    } else if (comp.avgSalePrice != null && comp.avgSalePrice > 0) {
      estimatedValue = {
        value: comp.avgSalePrice,
        provenance: "AI_ESTIMATED",
        confidence: compConfidence,
        sourceNote: "Neighborhood average price, not this property's own value.",
        isSample: compSample,
      };
      estimatedValueBasis = "AREA_AVERAGE";
      dataAgeMonths = monthsBetween(comp.periodStart, now);
    }
  }

  // --- Price per sqm ---
  let pricePerSqm: Figure | null = null;
  if (estimatedValue && estimatedValueBasis !== "AREA_AVERAGE" && area != null) {
    pricePerSqm = {
      ...estimatedValue,
      value: estimatedValue.value / area,
      provenance: "AI_ESTIMATED",
      confidence: derivedConfidence(estimatedValue.confidence),
    };
  } else if (comp?.avgPricePerSqm != null && comp.avgPricePerSqm > 0) {
    pricePerSqm = {
      value: comp.avgPricePerSqm,
      provenance: "AI_ESTIMATED",
      confidence: compConfidence,
      sourceNote: "Neighborhood average, not property-specific.",
      isSample: compSample,
    };
  }

  // --- Listed (asking) rent, always per month ---
  let listedRent: Figure | null = null;
  let listedRentAnnual: number | null = null;
  if (rentListing && rentListing.price > 0) {
    listedRent = {
      value: monthlyListedRent(rentListing.price, rentListing.rentPeriod),
      provenance: rentListing.provenance,
      confidence: rentListing.confidence,
      sourceNote: null,
      isSample: rentListing.isSample,
    };
    if (rentListing.rentPeriod === "ANNUAL") listedRentAnnual = rentListing.price;
  }

  // --- Expected market rent for this property ---
  const rentPerSqm = comp ? areaRentPerSqm(comp) : null;
  const ownRent = expectedRentForArea(area, rentPerSqm);
  let expectedRent: Figure | null = null;
  let expectedRentBasis: Exclude<FigureBasis, "STORED"> | null = null;
  if (comp && ownRent != null) {
    expectedRent = {
      value: ownRent,
      provenance: "AI_ESTIMATED",
      confidence: compConfidence,
      sourceNote: "This property's floor area x the area's rent per square metre.",
      isSample: ownSample,
    };
    expectedRentBasis = "THIS_PROPERTY";
  } else if (comp?.avgRentMonthly != null && comp.avgRentMonthly > 0) {
    expectedRent = {
      value: comp.avgRentMonthly,
      provenance: "AI_ESTIMATED",
      confidence: compConfidence,
      sourceNote: "Neighborhood average, not property-specific.",
      isSample: compSample,
    };
    expectedRentBasis = "AREA_AVERAGE";
  }

  // --- Gross yield: advertised rent first, else this property's estimate ---
  // An area-average rent or value is never used (it would flatter or punish
  // a home for the neighbourhood's average size).
  const choice = chooseYieldRent({
    askingMonthly: listedRent?.value ?? null,
    estimateMonthly: expectedRentBasis === "THIS_PROPERTY" ? expectedRent!.value : null,
  });
  const rentFigure =
    choice.basis === "ASKING" ? listedRent : choice.basis === "ESTIMATE" ? expectedRent : null;
  const valueUsable = estimatedValue != null && estimatedValueBasis !== "AREA_AVERAGE";

  let grossYieldPct: Figure | null = null;
  if (valueUsable && rentFigure && choice.monthlyRent != null && estimatedValue!.value > 0) {
    const r = rentalYield({
      purchasePrice: estimatedValue!.value,
      monthlyRent: choice.monthlyRent,
      annualExpenses: 0,
    });
    grossYieldPct = {
      value: r.grossYieldPct,
      provenance: "AI_ESTIMATED",
      confidence: derivedConfidence(estimatedValue!.confidence, rentFigure.confidence),
      sourceNote: null,
      // The yield always rests on this home's own value, so a sample home
      // makes it sample too (and the score below follows the yield).
      isSample: anySample([estimatedValue, rentFigure, home]),
    };
  }

  // Say which missing input stopped the yield (checked in the order the
  // yield needs them: a rent of its own, then a usable value).
  let yieldMissingReason: YieldMissingReason | null = null;
  if (!grossYieldPct) {
    if (!rentFigure) {
      // No advertised rent, and no per-property rent estimate.
      yieldMissingReason = area == null ? "NO_FLOOR_AREA" : "NO_AREA_FIGURES";
    } else if (!valuation) {
      // A rent exists; the value is missing or only an area average.
      yieldMissingReason = area == null ? "NO_FLOOR_AREA" : "NO_AREA_FIGURES";
    } else {
      yieldMissingReason = "NO_VALUE";
    }
  }

  const investment = investmentScore({
    grossYieldPct: grossYieldPct?.value ?? null,
    confidence: grossYieldPct?.confidence ?? 0,
    dataAgeMonths,
  });

  return {
    estimatedValue,
    estimatedValueBasis,
    pricePerSqm,
    listedRent,
    listedRentAnnual,
    expectedRent,
    expectedRentBasis,
    floorAreaSqm: area,
    rentPerSqm,
    grossYieldPct,
    yieldBasis: grossYieldPct ? choice.basis : "NONE",
    yieldRentUsed: grossYieldPct ? choice.monthlyRent : null,
    yieldMissingReason,
    investment,
    investmentConfidence: grossYieldPct?.confidence ?? null,
    investmentIsSample: grossYieldPct?.isSample ?? false,
  };
}
