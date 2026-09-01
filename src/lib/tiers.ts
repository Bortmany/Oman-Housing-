import type { Tier } from "@prisma/client";

// Paid-plan plumbing. Each tier caps how many LIVE (ACTIVE) listings an agency
// may have at once. Today the owner grants a tier by hand from the admin; a
// future payment gateway flips the exact same Tier field — nothing else changes.
// Pure functions, no I/O — tested in tiers.test.ts alongside the calculators.

// Infinity = unlimited. Numbers are sensible starting points the owner can tune.
export const ACTIVE_LISTING_LIMIT: Record<Tier, number> = {
  FREE: 3,
  PREMIUM: 25,
  BUSINESS: Infinity,
};

// What each tier costs an agency per month, in whole Omani rials.
// Billing is manual for now: there is no payment gateway in the app, so the
// owner agrees the price with the agency and switches the tier by hand from
// /admin/agencies. These numbers are the single source of truth for the price
// shown on the public "list with us" page.
export const TIER_PRICE_OMR: Record<Tier, number> = {
  FREE: 0,
  PREMIUM: 19,
  BUSINESS: 49,
};

/** The tiers in the order they are shown to the public, cheapest first. */
export const TIER_ORDER: Tier[] = ["FREE", "PREMIUM", "BUSINESS"];

export type ListingAllowance = {
  limit: number; // Infinity for unlimited
  used: number; // current live (ACTIVE) listings
  remaining: number; // Infinity when unlimited; never below 0
  canAdd: boolean; // room for at least one more live listing
  unlimited: boolean;
};

/** How much room an agency on `tier` has, given its current live-listing count. */
export function listingAllowance(tier: Tier, activeCount: number): ListingAllowance {
  const limit = ACTIVE_LISTING_LIMIT[tier];
  const used = Math.max(0, activeCount);
  const unlimited = limit === Infinity;
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return { limit, used, remaining, canAdd: remaining > 0, unlimited };
}

/** True when an agency on `tier` may take on one more live listing. */
export function canAddListing(tier: Tier, activeCount: number): boolean {
  return listingAllowance(tier, activeCount).canAdd;
}
