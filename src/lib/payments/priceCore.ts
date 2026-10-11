// Featured-listing prices — the pure half (no database). The values live in
// the SiteSetting table as text; a missing row means the default below.
// Tested in payments.test.ts.

import { baisaToAmount, toBaisa } from "./baisa";

export const PRICE_KEYS = {
  featuredOwner: "price.featured.owner",
  featuredAgency: "price.featured.agency",
  featuredDays: "featured.days",
  adHomeBand: "price.ad.homeBand",
  adMarketSidebar: "price.ad.marketSidebar",
  adPropertyBelow: "price.ad.propertyBelow",
  adNeighborhoodSponsor: "price.ad.neighborhoodSponsor",
} as const;

export type PriceKey = (typeof PRICE_KEYS)[keyof typeof PRICE_KEYS];

export const PRICE_DEFAULTS: Record<PriceKey, string> = {
  "price.featured.owner": "3.000",
  "price.featured.agency": "6.000",
  "featured.days": "30",
  "price.ad.homeBand": "60.000",
  "price.ad.marketSidebar": "35.000",
  "price.ad.propertyBelow": "45.000",
  "price.ad.neighborhoodSponsor": "30.000",
};

export const MAX_PRICE_BAISA = 10_000_000; // 10 000.000 OMR
export const MIN_DAYS = 1;
export const MAX_DAYS = 365;

/** An amount above zero, at most 3 decimals, at most 10000.000. Returns "x.xxx" or null. */
export function parsePriceAmount(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  // Arabic-Indic digits and the Arabic decimal comma are accepted as typed.
  const text = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫٬,]/g, ".");
  const baisa = toBaisa(text);
  if (baisa == null || baisa <= 0 || baisa > MAX_PRICE_BAISA) return null;
  return baisaToAmount(baisa);
}

/** A whole number of days, 1-365, or null. */
export function parseDays(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n >= MIN_DAYS && n <= MAX_DAYS ? n : null;
}

/** A stored value that is bad or missing falls back to the default. */
export function amountOrDefault(raw: string | null | undefined, key: PriceKey): string {
  return parsePriceAmount(raw) ?? PRICE_DEFAULTS[key];
}

export function daysOrDefault(raw: string | null | undefined): number {
  return parseDays(raw) ?? Number(PRICE_DEFAULTS[PRICE_KEYS.featuredDays]);
}

export type FeaturedPrice = { amount: string; baisa: number; days: number; audience: "owner" | "agency" };

/** The price for one seller: the agency price if the listing has an agency, else the owner price. */
export function featuredPriceFor(
  agencyId: string | null,
  settings: Partial<Record<PriceKey, string | null>>,
): FeaturedPrice {
  const audience = agencyId ? "agency" : "owner";
  const key = agencyId ? PRICE_KEYS.featuredAgency : PRICE_KEYS.featuredOwner;
  const amount = amountOrDefault(settings[key], key);
  return {
    amount,
    baisa: toBaisa(amount)!,
    days: daysOrDefault(settings[PRICE_KEYS.featuredDays]),
    audience,
  };
}
