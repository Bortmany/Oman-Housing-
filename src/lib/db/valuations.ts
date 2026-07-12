import { prisma } from "@/lib/prisma";
import type { DataProvenance } from "@prisma/client";
import { decimalToNumber } from "@/lib/money";
import { rentalYield } from "@/lib/calculators/rentalYield";
import {
  investmentScore,
  type InvestmentScoreResult,
} from "@/lib/calculators/investmentScore";
import { activeListingsForProperty, nearestMarketStat } from "./listings";

// Every figure carries its own provenance. Derived/computed figures are ALWAYS
// AI_ESTIMATED with capped confidence — never VERIFIED or OFFICIAL_STAT.

export type Figure = {
  value: number;
  provenance: DataProvenance;
  confidence: number;
  sourceNote: string | null;
};

export type PropertyFinancials = {
  estimatedValue: Figure | null;
  pricePerSqm: Figure | null;
  listedRent: Figure | null; // real asking price from an ACTIVE rent listing
  expectedRent: Figure | null; // neighborhood-average estimate
  grossYieldPct: Figure | null;
  investment: InvestmentScoreResult;
  investmentConfidence: number | null;
};

const DERIVED_CONFIDENCE_CAP = 0.5;

function monthsSince(date: Date): number {
  return Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / (30 * 24 * 3600 * 1000)),
  );
}

export async function propertyFinancials(
  propertyId: string,
): Promise<PropertyFinancials> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { neighborhoodId: true, type: true, areaSqm: true },
  });
  if (!property) {
    return {
      estimatedValue: null, pricePerSqm: null, listedRent: null,
      expectedRent: null, grossYieldPct: null,
      investment: { score: null, band: "INSUFFICIENT_DATA" },
      investmentConfidence: null,
    };
  }

  const [valuation, comp, listings] = await Promise.all([
    prisma.valuationEstimate.findFirst({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    }),
    nearestMarketStat(property.neighborhoodId, property.type),
    activeListingsForProperty(propertyId),
  ]);

  const areaSqm = decimalToNumber(property.areaSqm);
  const compConfidence = comp
    ? Math.min(comp.confidence, DERIVED_CONFIDENCE_CAP)
    : 0;

  // --- Estimated market value ---
  let estimatedValue: Figure | null = null;
  let dataAgeMonths: number | null = null;
  if (valuation) {
    estimatedValue = {
      value: decimalToNumber(valuation.valueMid)!,
      provenance: valuation.provenance,
      confidence: valuation.confidence,
      sourceNote: valuation.assumptions,
    };
    dataAgeMonths = null; // stored valuation counts as fresh
  } else if (comp) {
    const perSqm = decimalToNumber(comp.avgPricePerSqm);
    const avgPrice = decimalToNumber(comp.avgSalePrice);
    const derived =
      perSqm != null && areaSqm != null ? perSqm * areaSqm : avgPrice;
    if (derived != null) {
      estimatedValue = {
        value: derived,
        provenance: "AI_ESTIMATED",
        confidence: compConfidence,
        sourceNote:
          "Derived from neighborhood comparable data — not a stored valuation.",
      };
      dataAgeMonths = monthsSince(comp.periodStart);
    }
  }

  // --- Price per sqm ---
  let pricePerSqm: Figure | null = null;
  if (estimatedValue && areaSqm != null && areaSqm > 0) {
    pricePerSqm = {
      ...estimatedValue,
      value: estimatedValue.value / areaSqm,
      provenance: "AI_ESTIMATED",
      confidence: Math.min(estimatedValue.confidence, DERIVED_CONFIDENCE_CAP),
    };
  } else if (comp?.avgPricePerSqm != null) {
    pricePerSqm = {
      value: decimalToNumber(comp.avgPricePerSqm)!,
      provenance: "AI_ESTIMATED",
      confidence: compConfidence,
      sourceNote: "Neighborhood average, not property-specific.",
    };
  }

  // --- Rent: real asking price vs market estimate ---
  const rentListing = listings.find((l) => l.listingType === "RENT");
  const listedRent: Figure | null = rentListing
    ? {
        value: decimalToNumber(rentListing.price)!,
        provenance: rentListing.provenance,
        confidence: rentListing.confidence,
        sourceNote: null,
      }
    : null;

  const expectedRent: Figure | null =
    comp?.avgRentMonthly != null
      ? {
          value: decimalToNumber(comp.avgRentMonthly)!,
          provenance: "AI_ESTIMATED",
          confidence: compConfidence,
          sourceNote: "Neighborhood average, not property-specific.",
        }
      : null;

  // --- Gross yield (derived ratio → always AI_ESTIMATED) ---
  let grossYieldPct: Figure | null = null;
  if (estimatedValue && expectedRent) {
    const r = rentalYield({
      purchasePrice: estimatedValue.value,
      monthlyRent: expectedRent.value,
      annualExpenses: 0,
    });
    grossYieldPct = {
      value: r.grossYieldPct,
      provenance: "AI_ESTIMATED",
      confidence: Math.min(estimatedValue.confidence, expectedRent.confidence),
      sourceNote: null,
    };
  }

  const investment = investmentScore({
    grossYieldPct: grossYieldPct?.value ?? null,
    confidence: grossYieldPct?.confidence ?? 0,
    dataAgeMonths,
  });

  return {
    estimatedValue, pricePerSqm, listedRent, expectedRent, grossYieldPct,
    investment,
    investmentConfidence: grossYieldPct?.confidence ?? null,
  };
}
