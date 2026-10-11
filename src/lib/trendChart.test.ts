// Regression test: "Price trends" drew empty axes and no lines.
// Cause: the lines animated in from nothing, so a chart captured or resized
// mid-animation (screenshots, print, the page being resized) showed axes only.
// The data was always fine. This proves (1) the data a chart gets still has
// lines to draw when a real official figure replaces a sample month and
// unapproved submissions are hidden, and (2) no chart line animates in.
import { readFileSync } from "node:fs";
import { publicStats } from "./statVisibility";

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL ${label}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const base = { neighborhoodId: "al-mouj", propertyType: "APARTMENT" as const };
const rows = [
  // An old invented month saved as an unapproved submission: hidden.
  { ...base, periodStart: new Date("2025-12-01"), isSample: true, provenance: "USER_SUBMITTED", verifiedAt: null },
  // Invented recent months: shown.
  ...["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"].map((d) => ({
    ...base,
    periodStart: new Date(d),
    isSample: true,
    provenance: "AI_ESTIMATED",
    verifiedAt: null,
  })),
  // A real official figure for June 2026 steps in front of the sample June.
  { ...base, periodStart: new Date("2026-06-01"), isSample: false, provenance: "OFFICIAL_STAT", verifiedAt: null },
];
const visible = publicStats(rows);
check("six monthly points remain to draw", visible.length === 6);
check(
  "June is the real official row",
  visible.filter((r) => r.periodStart.getUTCMonth() === 5).every((r) => !r.isSample),
);

const src = readFileSync(new URL("../components/charts/TrendChart.tsx", import.meta.url), "utf8");
check("chart lines do not animate in", /isAnimationActive=\{false\}/.test(src));

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll trend-chart tests passed.");
