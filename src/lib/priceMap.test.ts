// Price-map logic tests. Run with: npm test
//
// Core guarantee: the legend names the WEAKEST source among the drawn
// figures (Sample < AI estimated < User submitted < From live listings <
// Official < Verified; ties go to the lowest confidence). Also the colour
// steps (quintiles, fewer steps when few values) and the circle size.
import {
  MAX_RADIUS,
  MIN_RADIUS,
  NO_DATA_RADIUS,
  bucketFor,
  buildBreaks,
  buildPriceMap,
  radiusFor,
  scaleColors,
  weakestInput,
  type PriceMapInput,
  type SourceInput,
} from "./priceMap";
import { PRICE_SCALE } from "./chartPalette";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}\n       expected ${e}\n       got      ${a}`);
  }
}

const src = (
  provenance: SourceInput["provenance"],
  confidence = 0.8,
  isSample = false,
): SourceInput => ({ provenance, confidence, isSample });

// ---------- weakest source ----------
console.log("weakest source");
expectEqual("no rows -> null", weakestInput([]), null);
expectEqual(
  "order: AI < user < listings < official < verified",
  weakestInput([src("VERIFIED"), src("OFFICIAL_STAT"), src("LISTING_DERIVED"), src("USER_SUBMITTED"), src("AI_ESTIMATED")])
    ?.provenance,
  "AI_ESTIMATED",
);
expectEqual(
  "user < listings",
  weakestInput([src("LISTING_DERIVED"), src("USER_SUBMITTED")])?.provenance,
  "USER_SUBMITTED",
);
expectEqual(
  "listings < official",
  weakestInput([src("OFFICIAL_STAT"), src("LISTING_DERIVED")])?.provenance,
  "LISTING_DERIVED",
);
{
  const many = Array.from({ length: 10 }, () => src("OFFICIAL_STAT", 0.95));
  const w = weakestInput([...many, src("VERIFIED", 0.9, true)]);
  expectEqual("one sample row beats ten official rows", w?.isSample, true);
}
expectEqual(
  "sample is weaker than AI estimated",
  weakestInput([src("AI_ESTIMATED", 0.3), src("VERIFIED", 0.9, true)])?.isSample,
  true,
);
expectEqual(
  "tie -> lowest confidence",
  weakestInput([src("OFFICIAL_STAT", 0.9), src("OFFICIAL_STAT", 0.6), src("OFFICIAL_STAT", 0.8)])?.confidence,
  0.6,
);
expectEqual(
  "tie among samples -> lowest confidence",
  weakestInput([src("USER_SUBMITTED", 0.7, true), src("AI_ESTIMATED", 0.4, true)])?.confidence,
  0.4,
);

// ---------- breaks ----------
console.log("colour steps");
expectEqual("no values -> no steps", buildBreaks([]), []);
expectEqual("one value -> one step", buildBreaks([500]), [500]);
expectEqual("3 values -> 3 steps", buildBreaks([300, 100, 200]), [100, 200, 300]);
expectEqual(
  "10 values -> 5 equal-count steps",
  buildBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  [1, 3, 5, 7, 9],
);
expectEqual("repeated values never make an empty step", buildBreaks([1, 1, 1, 2, 2]), [1, 2]);
expectEqual("all the same -> one step", buildBreaks([5, 5, 5]), [5]);
expectEqual("bucketFor lowest", bucketFor(1, [1, 3, 5]), 0);
expectEqual("bucketFor mid", bucketFor(4, [1, 3, 5]), 1);
expectEqual("bucketFor top", bucketFor(99, [1, 3, 5]), 2);
expectEqual("bucketFor below first bound", bucketFor(0, [1, 3, 5]), 0);
expectEqual("5 steps use the whole scale", scaleColors(5), [...PRICE_SCALE]);
expectEqual("1 step -> middle colour", scaleColors(1), [PRICE_SCALE[2]]);
expectEqual("2 steps -> lightest and darkest", scaleColors(2), [PRICE_SCALE[0], PRICE_SCALE[4]]);
expectEqual("3 steps -> light, mid, dark", scaleColors(3), [PRICE_SCALE[0], PRICE_SCALE[2], PRICE_SCALE[4]]);

// ---------- radius ----------
console.log("circle size");
expectEqual("missing sample size -> floor", radiusFor(null), MIN_RADIUS);
expectEqual("zero -> floor", radiusFor(0), MIN_RADIUS);
expectEqual("huge -> ceiling", radiusFor(1_000_000), MAX_RADIUS);
expectEqual("floor is 12, ceiling is 28", [MIN_RADIUS, MAX_RADIUS], [12, 28]);
expectEqual("bigger sample -> bigger circle", radiusFor(50) > radiusFor(10), true);
expectEqual("always within 12..28", [1, 5, 25, 60, 99].every((n) => radiusFor(n) >= 12 && radiusFor(n) <= 28), true);
expectEqual("square-root growth (4x sample = 2x of the spread)", radiusFor(100) - radiusFor(25) > radiusFor(25) - radiusFor(0), false);

// ---------- the whole map ----------
console.log("assembling the map");
const row = (over: Partial<PriceMapInput>): PriceMapInput => ({
  slug: "a",
  name: "A",
  lat: 23.6,
  lng: 58.4,
  price: 1000,
  sampleSize: 20,
  periodStart: new Date("2026-08-01T00:00:00Z"),
  provenance: "OFFICIAL_STAT",
  confidence: 0.9,
  isSample: false,
  ...over,
});
{
  const m = buildPriceMap([
    row({ slug: "a", price: 900 }),
    row({ slug: "b", price: 1200, isSample: true, confidence: 0.4 }),
    row({ slug: "c", price: null, provenance: null, sampleSize: null, periodStart: null }),
    row({ slug: "d", lat: null, lng: null, price: 800 }),
  ]);
  expectEqual("null price -> grey circle", m.points.find((p) => p.slug === "c")?.step, null);
  expectEqual("grey circle is small", m.points.find((p) => p.slug === "c")?.radius, NO_DATA_RADIUS);
  expectEqual("no-data area is flagged", m.hasNoData, true);
  expectEqual("area without coordinates is not drawn", m.points.some((p) => p.slug === "d"), false);
  expectEqual("...but is counted as unplaced", m.unplaced, 1);
  expectEqual("weakest is the sample row", m.weakest?.isSample, true);
  expectEqual("two figures -> two steps", m.steps.length, 2);
}
{
  const m = buildPriceMap([
    row({ slug: "a", price: 900 }),
    row({ slug: "c", price: null, provenance: "AI_ESTIMATED", confidence: 0.1, isSample: true }),
  ]);
  expectEqual(
    "a row with no price is left out of the weakest-source calculation",
    m.weakest?.provenance,
    "OFFICIAL_STAT",
  );
}
{
  const m = buildPriceMap([row({ price: null, provenance: null })]);
  expectEqual("nothing coloured -> no weakest source", m.weakest, null);
  expectEqual("nothing coloured -> no legend steps", m.steps, []);
}

if (failures > 0) {
  console.error(`\n${failures} price map test(s) failed`);
  process.exit(1);
}
console.log("\nall price map tests passed");
