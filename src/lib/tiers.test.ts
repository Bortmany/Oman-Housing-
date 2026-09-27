// Tier / listing-allowance tests. Run with: npm test
import {
  ACTIVE_LISTING_LIMIT,
  TIER_ORDER,
  TIER_PRICE_OMR,
  canAddListing,
  listingAllowance,
} from "./tiers";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

// FREE agency: 3 live listings, then blocked
expectEqual("free.limit", ACTIVE_LISTING_LIMIT.FREE, 3);
expectEqual("free.canAdd.empty", canAddListing("FREE", 0), true);
expectEqual("free.canAdd.atTwo", canAddListing("FREE", 2), true);
expectEqual("free.canAdd.atCap", canAddListing("FREE", 3), false);
expectEqual("free.canAdd.overCap", canAddListing("FREE", 5), false);

// PREMIUM: 25
expectEqual("premium.canAdd.at24", canAddListing("PREMIUM", 24), true);
expectEqual("premium.canAdd.at25", canAddListing("PREMIUM", 25), false);

// BUSINESS: unlimited
expectEqual("business.unlimited", listingAllowance("BUSINESS", 1000).unlimited, true);
expectEqual("business.canAdd", canAddListing("BUSINESS", 100000), true);

// Allowance maths
{
  const a = listingAllowance("FREE", 1);
  expectEqual("allowance.used", a.used, 1);
  expectEqual("allowance.remaining", a.remaining, 2);
  expectEqual("allowance.canAdd", a.canAdd, true);
}
{
  const a = listingAllowance("FREE", 3);
  expectEqual("allowance.atCap.remaining", a.remaining, 0);
  expectEqual("allowance.atCap.canAdd", a.canAdd, false);
}
{
  // never report negative remaining even if somehow over the cap
  const a = listingAllowance("FREE", 9);
  expectEqual("allowance.overCap.remaining", a.remaining, 0);
}
{
  const a = listingAllowance("BUSINESS", 5);
  expectEqual("allowance.business.remaining", a.remaining, Infinity);
}

// Published monthly prices (OMR). These are what the public page shows.
expectEqual("price.free", TIER_PRICE_OMR.FREE, 0);
expectEqual("price.premium", TIER_PRICE_OMR.PREMIUM, 19);
expectEqual("price.business", TIER_PRICE_OMR.BUSINESS, 49);

// Every tier that has a listing cap also has a price, and vice versa —
// so the pricing table can never miss a plan.
for (const tier of Object.keys(ACTIVE_LISTING_LIMIT) as (keyof typeof ACTIVE_LISTING_LIMIT)[]) {
  expectEqual(`price.exists.${tier}`, typeof TIER_PRICE_OMR[tier], "number");
  expectEqual(`price.finite.${tier}`, Number.isFinite(TIER_PRICE_OMR[tier]), true);
  expectEqual(`price.notNegative.${tier}`, TIER_PRICE_OMR[tier] >= 0, true);
  expectEqual(`order.includes.${tier}`, TIER_ORDER.includes(tier), true);
}
expectEqual("order.length", TIER_ORDER.length, Object.keys(ACTIVE_LISTING_LIMIT).length);
expectEqual("order.cheapestFirst", TIER_ORDER[0], "FREE");

// A bigger price must buy at least as many listing slots.
expectEqual(
  "price.tracksAllowance",
  TIER_PRICE_OMR.PREMIUM < TIER_PRICE_OMR.BUSINESS &&
    ACTIVE_LISTING_LIMIT.PREMIUM < ACTIVE_LISTING_LIMIT.BUSINESS &&
    TIER_PRICE_OMR.FREE < TIER_PRICE_OMR.PREMIUM &&
    ACTIVE_LISTING_LIMIT.FREE < ACTIVE_LISTING_LIMIT.PREMIUM,
  true,
);

if (failures > 0) {
  console.error(`\n${failures} tier test(s) failed`);
  process.exit(1);
}
console.log("\nAll tier tests passed.");
