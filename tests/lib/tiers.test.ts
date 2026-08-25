// Tier / listing-allowance tests.
import { describe, expect, test } from "vitest";
import { ACTIVE_LISTING_LIMIT, canAddListing, listingAllowance } from "@/lib/tiers";

describe("FREE tier", () => {
  test("3 live listings, then blocked", () => {
    expect(ACTIVE_LISTING_LIMIT.FREE).toBe(3);
    expect(canAddListing("FREE", 0)).toBe(true);
    expect(canAddListing("FREE", 2)).toBe(true);
    expect(canAddListing("FREE", 3)).toBe(false);
    expect(canAddListing("FREE", 5)).toBe(false);
  });
});

describe("PREMIUM tier", () => {
  test("25 live listings, then blocked", () => {
    expect(canAddListing("PREMIUM", 24)).toBe(true);
    expect(canAddListing("PREMIUM", 25)).toBe(false);
  });
});

describe("BUSINESS tier", () => {
  test("unlimited", () => {
    expect(listingAllowance("BUSINESS", 1000).unlimited).toBe(true);
    expect(canAddListing("BUSINESS", 100000)).toBe(true);
  });
});

describe("listingAllowance", () => {
  test("used/remaining/canAdd under the cap", () => {
    const a = listingAllowance("FREE", 1);
    expect(a.used).toBe(1);
    expect(a.remaining).toBe(2);
    expect(a.canAdd).toBe(true);
  });

  test("at the cap", () => {
    const a = listingAllowance("FREE", 3);
    expect(a.remaining).toBe(0);
    expect(a.canAdd).toBe(false);
  });

  test("never reports negative remaining even if somehow over the cap", () => {
    const a = listingAllowance("FREE", 9);
    expect(a.remaining).toBe(0);
  });

  test("BUSINESS remaining is Infinity", () => {
    const a = listingAllowance("BUSINESS", 5);
    expect(a.remaining).toBe(Infinity);
  });
});
