// Saved-search tests. Run with: npm test
//
// Proves the filter clean-up that runs before a search is saved to someone's
// account: only the filters the search page understands are kept, in a fixed
// order, blanks and over-long values are dropped, and junk never gets stored.
import {
  isFrequency,
  normalizeSearchQuery,
  searchQueryToObject,
} from "./savedSearch";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

expectEqual(
  "keeps known filters in a fixed order",
  normalizeSearchQuery("?beds=3&hood=al-mouj&type=VILLA"),
  "hood=al-mouj&type=VILLA&beds=3",
);
expectEqual(
  "drops unknown parameters",
  normalizeSearchQuery("hood=qurum&utm_source=ad&admin=1&page=4"),
  "hood=qurum",
);
expectEqual(
  "drops blank and whitespace-only values, trims the rest",
  normalizeSearchQuery("hood=%20&type=&minPrice=%2050000%20"),
  "minPrice=50000",
);
expectEqual(
  "drops a value longer than 64 characters",
  normalizeSearchQuery(`hood=${"x".repeat(65)}&beds=2`),
  "beds=2",
);
expectEqual(
  "keeps a value of exactly 64 characters",
  normalizeSearchQuery(`hood=${"x".repeat(64)}`),
  `hood=${"x".repeat(64)}`,
);
expectEqual(
  "keeps only the first of a repeated filter",
  normalizeSearchQuery("type=VILLA&type=APARTMENT"),
  "type=VILLA",
);
expectEqual("an empty search stays empty", normalizeSearchQuery(""), "");
expectEqual("junk only becomes empty", normalizeSearchQuery("?foo=bar&<script>=1"), "");

expectEqual(
  "stored query back to an object, unknown keys ignored",
  searchQueryToObject("hood=qurum&maxPrice=200000&evil=1"),
  { hood: "qurum", maxPrice: "200000" },
);

expectEqual("daily is a frequency", isFrequency("daily"), true);
expectEqual("weekly is not a frequency", isFrequency("weekly"), false);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll saved-search tests passed.");
