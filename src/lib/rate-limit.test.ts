// Rate-limit / IP-trust tests. Run with: npm test
//
// Imports from clientIp.ts directly, not rate-limit.ts — rate-limit.ts is
// "server-only" (guards its stateful in-memory store), which throws when
// imported outside Next's own bundler; clientIp.ts is the same function
// rate-limit.ts re-exports, split out precisely so it stays unit-testable.
import { getClientIp } from "./clientIp";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

function headersWith(values: Record<string, string>): Headers {
  return new Headers(values);
}

// Without TRUST_PROXY_HEADERS set, a visitor-supplied X-Forwarded-For is
// ignored — trusting it would let anyone spoof their way past the per-IP
// login/signup limiter.
delete process.env.TRUST_PROXY_HEADERS;
expectEqual(
  "untrusted.ignoresSpoofedXff",
  getClientIp(headersWith({ "x-forwarded-for": "9.9.9.9" })),
  "unknown",
);
expectEqual(
  "untrusted.ignoresSpoofedRealIp",
  getClientIp(headersWith({ "x-real-ip": "9.9.9.9" })),
  "unknown",
);

// With TRUST_PROXY_HEADERS=true (the app is behind a proxy that overwrites
// these headers itself, e.g. Railway), the forwarded IP is used.
process.env.TRUST_PROXY_HEADERS = "true";
expectEqual(
  "trusted.usesFirstXffHop",
  getClientIp(headersWith({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })),
  "203.0.113.5",
);
expectEqual(
  "trusted.fallsBackToRealIp",
  getClientIp(headersWith({ "x-real-ip": "203.0.113.9" })),
  "203.0.113.9",
);
expectEqual(
  "trusted.noHeaders.fallsBackToUnknown",
  getClientIp(headersWith({})),
  "unknown",
);
delete process.env.TRUST_PROXY_HEADERS;

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll rate-limit tests passed.");
