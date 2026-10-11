import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/money";
import {
  EMPTY_FINANCIALS,
  workOutPropertyFinancials,
  type PropertyFinancials,
} from "@/lib/calculators/propertyFinancials";
import { activeListingsForProperty, nearestMarketStat } from "./listings";
import { isSampleValuation, preferRealValuation } from "./sampleData";

// Reads the rows one property's financials need, then hands them to the pure
// calculator (src/lib/calculators/propertyFinancials.ts) — no financial maths
// here. Every figure carries its own provenance and `isSample`; derived
// figures are ALWAYS AI_ESTIMATED with capped confidence — never VERIFIED or
// OFFICIAL_STAT. The property page, the compare cards and the AI analyst all
// call this one function, so they can never disagree.

export type {
  Figure,
  FigureBasis,
  PropertyFinancials,
} from "@/lib/calculators/propertyFinancials";

export async function propertyFinancials(
  propertyId: string,
): Promise<PropertyFinancials> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { neighborhoodId: true, type: true, areaSqm: true, isSample: true },
  });
  if (!property) return EMPTY_FINANCIALS;

  const [valuations, comp, listings] = await Promise.all([
    prisma.valuationEstimate.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    nearestMarketStat(property.neighborhoodId, property.type),
    activeListingsForProperty(propertyId),
  ]);

  // A real valuation beats a sample one (the one rule, sampleData.ts). A
  // valuation of a sample home is sample whatever its own flag says.
  const valuation = preferRealValuation(valuations);
  const rentListing = listings.find((l) => l.listingType === "RENT") ?? null;

  return workOutPropertyFinancials({
    floorAreaSqm: decimalToNumber(property.areaSqm),
    propertyIsSample: property.isSample,
    valuation: valuation
      ? {
          valueMid: decimalToNumber(valuation.valueMid)!,
          provenance: valuation.provenance,
          confidence: valuation.confidence,
          assumptions: valuation.assumptions,
          isSample: isSampleValuation(valuation, property),
        }
      : null,
    comp: comp
      ? {
          avgRentMonthly: decimalToNumber(comp.avgRentMonthly),
          avgPricePerSqm: decimalToNumber(comp.avgPricePerSqm),
          avgSalePrice: decimalToNumber(comp.avgSalePrice),
          confidence: comp.confidence,
          isSample: comp.isSample,
          periodStart: comp.periodStart,
        }
      : null,
    rentListing: rentListing
      ? {
          price: decimalToNumber(rentListing.price)!,
          rentPeriod: rentListing.rentPeriod,
          provenance: rentListing.provenance,
          confidence: rentListing.confidence,
          isSample: rentListing.isSample, // already resolved (sample home ⇒ sample)
        }
      : null,
    now: new Date(),
  });
}
