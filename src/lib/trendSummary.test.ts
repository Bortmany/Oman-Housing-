// Home-page trend summary tests. Run with: npm test
//
// Proves the home-page trend cards only show real, stored figures: the change
// is worked out from the stored prices, the window is the last 12 months, and
// the badge carries the weakest source and lowest confidence of the points
// used — so a derived figure can never look more trustworthy than its inputs.
import { summarizeTrend, weakestProvenance, type TrendInputPoint } from "./trendSummary";

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

const month = (i: number) => new Date(Date.UTC(2025, i, 1));
const pt = (
  i: number,
  value: number | null,
  provenance: TrendInputPoint["provenance"] = "VERIFIED",
  confidence = 0.9,
): TrendInputPoint => ({ periodStart: month(i), value, provenance, confidence });

{
  // 100 → 110 over two points: +10%.
  const s = summarizeTrend([pt(1, 110), pt(0, 100)])!;
  expectEqual("change from stored prices (order-independent)", Math.round(s.changePct * 1000) / 1000, 10);
  expectEqual("series runs oldest to newest", s.series, [100, 110]);
}

{
  // 20 months of data: only the last 13 points (12 months of change) count.
  const pts = Array.from({ length: 20 }, (_, i) => pt(i, 100 + i));
  const s = summarizeTrend(pts)!;
  expectEqual("window is the last 12 months", s.series.length, 13);
  expectEqual("window starts 12 months before the latest", s.from.toISOString(), month(7).toISOString());
  expectEqual("window ends at the latest month", s.to.toISOString(), month(19).toISOString());
}

{
  // One weak point inside the window drags the badge down.
  const s = summarizeTrend([
    pt(0, 100, "VERIFIED", 0.95),
    pt(1, 102, "AI_ESTIMATED", 0.35),
    pt(2, 104, "OFFICIAL_STAT", 0.8),
  ])!;
  expectEqual("badge takes the weakest source", s.provenance, "AI_ESTIMATED");
  expectEqual("badge takes the lowest confidence", s.confidence, 0.35);
}

{
  // A weak point that fell outside the window no longer counts.
  const pts = [pt(0, 90, "USER_SUBMITTED", 0.2), ...Array.from({ length: 13 }, (_, i) => pt(i + 1, 100))];
  const s = summarizeTrend(pts)!;
  expectEqual("old weak point outside the window is ignored", s.provenance, "VERIFIED");
}

expectEqual("no figures → no card", summarizeTrend([]), null);
expectEqual("one figure → no card", summarizeTrend([pt(0, 100)]), null);
expectEqual("missing and zero prices are skipped", summarizeTrend([pt(0, null), pt(1, 0), pt(2, 100)]), null);

expectEqual("weakest of verified + official", weakestProvenance(["VERIFIED", "OFFICIAL_STAT"]), "OFFICIAL_STAT");
expectEqual("weakest of user + AI", weakestProvenance(["USER_SUBMITTED", "AI_ESTIMATED"]), "AI_ESTIMATED");

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll trend-summary tests passed.");
