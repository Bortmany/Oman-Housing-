// Featured-listing rules (pure). Run with: npm test
import { MAX_FEATURED_PER_PAGE, extendFeaturedUntil, hourStamp, hasFeaturedListing, isFeaturedNow, pickFeatured } from "./featured";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const now = new Date("2026-10-10T10:30:00Z");
const future = new Date(now.getTime() + 5 * DAY);
const past = new Date(now.getTime() - 1000);
const mk = (id: string, until: Date | null) => ({ id, featuredUntil: until });

// The cap is a constant, not a setting.
expectEqual("cap is 3", MAX_FEATURED_PER_PAGE, 3);

// ----- featured right now? -----
expectEqual("future date is featured", isFeaturedNow(future, now), true);
expectEqual("past date is not featured", isFeaturedNow(past, now), false);
expectEqual("detail: one featured listing shows the label", hasFeaturedListing([{ featuredUntil: past }, { featuredUntil: future }], now), true);
expectEqual("detail: none featured, no label", hasFeaturedListing([{ featuredUntil: past }, { featuredUntil: null }], now), false);
expectEqual("exactly now is not featured", isFeaturedNow(now, now), false);
expectEqual("no date is not featured", isFeaturedNow(null, now), false);

// ----- extending -----
expectEqual("extend from nothing starts now", extendFeaturedUntil(null, now, 30).toISOString(), new Date(now.getTime() + 30 * DAY).toISOString());
expectEqual("extend an expired date starts now", extendFeaturedUntil(past, now, 30).toISOString(), new Date(now.getTime() + 30 * DAY).toISOString());
expectEqual("extend a running date adds after its end", extendFeaturedUntil(future, now, 30).toISOString(), new Date(future.getTime() + 30 * DAY).toISOString());

// ----- picking -----
const five = ["a1", "b2", "c3", "d4", "e5"].map((id) => mk(id, future));
const hour = hourStamp(now);
const picked = pickFeatured(five, hour, 3, now);
expectEqual("never more than 3", picked.length, 3);
expectEqual("no duplicates", new Set(picked.map((p) => p.id)).size, 3);
expectEqual("default max is the cap", pickFeatured(five, hour, undefined, now).length, 3);
expectEqual("fewer than 3 gives all of them", pickFeatured(five.slice(0, 2), hour, 3, now).length, 2);
expectEqual("same hour, same answer", pickFeatured(five, hour, 3, now).map((p) => p.id), picked.map((p) => p.id));
expectEqual("input order does not matter", pickFeatured([...five].reverse(), hour, 3, now).map((p) => p.id), picked.map((p) => p.id));
expectEqual("expired never picked", pickFeatured([mk("x", past), mk("y", null), mk("z", future)], hour, 3, now).map((p) => p.id), ["z"]);
expectEqual("duplicates in the input count once", pickFeatured([mk("z", future), mk("z", future)], hour, 3, now).length, 1);

// Rotation: over many hours every one of five listings gets a lead slot, and
// the lead set changes between hours.
const seen = new Set<string>();
const sets = new Set<string>();
for (let h = 0; h < 48; h++) {
  const lead = pickFeatured(five, hour + h, 3, now).map((p) => p.id);
  lead.forEach((id) => seen.add(id));
  sets.add(lead.join(","));
}
expectEqual("rotation reaches every featured listing", seen.size, 5);
expectEqual("the lead set changes across hours", sets.size > 1, true);

// Fairness: over a long run each of 5 listings leads roughly 3/5 of the hours.
const counts: Record<string, number> = {};
for (let h = 0; h < 2000; h++) {
  for (const p of pickFeatured(five, h, 3, now)) counts[p.id] = (counts[p.id] ?? 0) + 1;
}
const fair = Object.values(counts).every((c) => c > 1000 && c < 1400); // expected 1200
expectEqual("rotation is fair between advertisers", fair, true);

if (failures > 0) {
  console.error(`\n${failures} featured test(s) failed`);
  process.exit(1);
}
console.log("\nAll featured tests passed.");
