// Enquiry-guard tests. Run with: npm test
import { ENQUIRY_DAILY_CAP, evaluateEnquiry } from "./enquiry";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

// A bot that filled the hidden field is rejected regardless of count
expectEqual(
  "honeypot.filled",
  evaluateEnquiry({ honeypot: "http://spam", recentCount: 0 }),
  "honeypot",
);
expectEqual(
  "honeypot.whitespaceOnlyIsEmpty",
  evaluateEnquiry({ honeypot: "   ", recentCount: 0 }),
  "ok",
);

// Under the cap → ok; at/over the cap → rate limited
expectEqual("rate.underCap", evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP - 1 }), "ok");
expectEqual("rate.atCap", evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP }), "rateLimited");
expectEqual("rate.overCap", evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP + 3 }), "rateLimited");

// Honeypot takes priority over the rate check
expectEqual(
  "honeypot.beforeRate",
  evaluateEnquiry({ honeypot: "x", recentCount: ENQUIRY_DAILY_CAP + 10 }),
  "honeypot",
);

if (failures > 0) {
  console.error(`\n${failures} enquiry test(s) failed`);
  process.exit(1);
}
console.log("\nAll enquiry tests passed.");
