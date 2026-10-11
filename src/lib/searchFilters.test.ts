// Property-search URL reading and the map box. Run with: npm test
//
// Proves parseSearchFilters keeps the rules the search page used to hold
// inline, and that the map box (n, s, e, w) is all-or-nothing, validated,
// rounded and clamped — so a hand-edited URL can never reach the database
// query, a chip or a saved search.
import {
  areaSearchQuery,
  boundsToQuery,
  clampBounds,
  parseBounds,
  parseSearchFilters,
  sameArea,
  withoutArea,
} from "./searchFilters";

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

const box = { n: "23.65", s: "23.55", e: "58.55", w: "58.3" };

// ---- bounds: valid ----
expectEqual(
  "a good box is read as numbers",
  parseBounds(box),
  { n: 23.65, s: 23.55, e: 58.55, w: 58.3 },
);
expectEqual(
  "values are rounded to 4 places",
  parseBounds({ n: "23.123456", s: "23.0000049", e: "58.55555", w: "58.3" }),
  { n: 23.1235, s: 23, e: 58.5556, w: 58.3 },
);
expectEqual(
  "reads from URLSearchParams too",
  parseBounds(new URLSearchParams("n=23.65&s=23.55&e=58.55&w=58.3")),
  { n: 23.65, s: 23.55, e: 58.55, w: 58.3 },
);
expectEqual(
  "negative coordinates are fine",
  parseBounds({ n: "-10", s: "-20", e: "-30", w: "-40" }),
  { n: -10, s: -20, e: -30, w: -40 },
);

// ---- bounds: invalid is ignored whole ----
expectEqual("text is ignored", parseBounds({ ...box, n: "abc" }), undefined);
expectEqual("empty is ignored", parseBounds({ ...box, s: "" }), undefined);
expectEqual("exponent form is ignored", parseBounds({ ...box, n: "1e1" }), undefined);
expectEqual("only two of four is ignored", parseBounds({ n: "23.65", s: "23.55" }), undefined);
expectEqual("nothing at all is ignored", parseBounds({}), undefined);
expectEqual("n=999 is ignored", parseBounds({ ...box, n: "999" }), undefined);
expectEqual("s=-91 is ignored", parseBounds({ ...box, s: "-91" }), undefined);
expectEqual("e=181 is ignored", parseBounds({ ...box, e: "181" }), undefined);
expectEqual("w=-181 is ignored", parseBounds({ ...box, w: "-181" }), undefined);
expectEqual("south above north is ignored", parseBounds({ ...box, s: "24", n: "23" }), undefined);
expectEqual("south equal north is ignored", parseBounds({ ...box, s: "23.65" }), undefined);
expectEqual("west past east (antimeridian) is ignored", parseBounds({ ...box, w: "59", e: "58" }), undefined);
expectEqual("a very long number is ignored", parseBounds({ ...box, n: "1".repeat(40) }), undefined);

// ---- clamping what the live map reports ----
expectEqual(
  "a zoomed-out world view is clamped to the world",
  clampBounds({ n: 95, s: -95, e: 200, w: -200 }),
  { n: 90, s: -90, e: 180, w: -180 },
);
expectEqual(
  "a normal view is only rounded",
  clampBounds({ n: 23.654321, s: 23.55, e: 58.55, w: 58.30009 }),
  { n: 23.6543, s: 23.55, e: 58.55, w: 58.3001 },
);
expectEqual(
  "a flat or non-number view is dropped",
  [clampBounds({ n: 1, s: 1, e: 2, w: 1 }), clampBounds({ n: NaN, s: 0, e: 2, w: 1 })],
  [undefined, undefined],
);

// ---- query helpers ----
expectEqual("no box gives no query parts", boundsToQuery(undefined), {});
expectEqual(
  "search-this-area drops hood and the old box, keeps the rest",
  areaSearchQuery(
    { hood: "qurum", type: "VILLA", beds: "3", n: "1", s: "0", e: "1", w: "0" },
    { n: 23.65, s: 23.55, e: 58.55, w: 58.3 },
  ),
  { type: "VILLA", beds: "3", n: "23.65", s: "23.55", e: "58.55", w: "58.3" },
);
expectEqual(
  "clearing the area keeps the other filters",
  withoutArea({ hood: "qurum", type: "VILLA", n: "1", s: "0", e: "1", w: "0" }),
  { hood: "qurum", type: "VILLA" },
);
expectEqual(
  "the same area, within rounding, is the same area",
  [
    sameArea({ n: 23.65, s: 23.55, e: 58.55, w: 58.3 }, { n: 23.6501, s: 23.5499, e: 58.55, w: 58.3 }),
    sameArea({ n: 23.65, s: 23.55, e: 58.55, w: 58.3 }, { n: 23.9, s: 23.55, e: 58.55, w: 58.3 }),
  ],
  [true, false],
);

// ---- parseSearchFilters: parity with the old inline page rules ----
expectEqual(
  "a full valid search is read as before",
  parseSearchFilters({
    hood: "al-mouj", type: "VILLA", listingType: "RENT",
    minPrice: "100", maxPrice: "900", beds: "3", ownership: "GCC_ELIGIBLE",
  }),
  {
    neighborhoodSlug: "al-mouj", type: "VILLA", listingType: "RENT",
    minPrice: 100, maxPrice: 900, minBedrooms: 3, ownership: "GCC_ELIGIBLE",
  },
);
expectEqual(
  "junk values are dropped",
  parseSearchFilters({
    type: "CASTLE", listingType: "LEASE", minPrice: "-5", maxPrice: "abc",
    beds: "", ownership: "EVERYONE",
  }),
  {},
);
expectEqual("an empty URL is no filters", parseSearchFilters({}), {});
expectEqual(
  "zero is a real number (min price 0)",
  parseSearchFilters({ minPrice: "0" }),
  { minPrice: 0 },
);
expectEqual(
  "the box rides along with the other filters",
  parseSearchFilters(new URLSearchParams("type=VILLA&n=23.65&s=23.55&e=58.55&w=58.3")),
  { type: "VILLA", bounds: { n: 23.65, s: 23.55, e: 58.55, w: 58.3 } },
);
expectEqual(
  "a broken box leaves the other filters alone",
  parseSearchFilters({ type: "VILLA", n: "999", s: "23.55", e: "58.55", w: "58.3" }),
  { type: "VILLA" },
);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll search-filter tests passed.");
