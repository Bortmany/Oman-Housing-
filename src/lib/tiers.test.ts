// Tier / listing-allowance tests. Run with: npm test
import { ACTIVE_LISTING_LIMIT, canAddListing, listingAllowance } from "./tiers";

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

if (failures > 0) {
  console.error(`\n${failures} tier test(s) failed`);
  process.exit(1);
}
console.log("\nAll tier tests passed.");
