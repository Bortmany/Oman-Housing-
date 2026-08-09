// Rate-limit / IP-trust tests. Run with: npm test
//
// Imports from clientIp.ts directly, not rate-limit.ts — rate-limit.ts is
// "server-only" (guards its stateful in-memory store), which throws when
// imported outside Next's own bundler; clientIp.ts is the same function
// rate-limit.ts re-exports, split out precisely so it stays unit-testable.
import { getClientIp, getSocketIp, SOCKET_IP_HEADER } from "./clientIp";

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

// ---------------------------------------------------------------------------
// The pentest finding: with TRUST_PROXY_HEADERS off (the default), every
// cookie-less caller used to collapse onto the single literal "unknown"
// bucket — a flood of cookie-dropping buyer-enquiry submissions from ANY one
// source exhausted that shared bucket and blocked every other new visitor's
// first enquiry. SOCKET_IP_HEADER is what src/instrumentation-node.ts stamps
// with the TRUE TCP socket address on every real request (never spoofable by
// the caller); getClientIp() must use it as the fallback instead of the bare
// "unknown" literal whenever it is present.
// ---------------------------------------------------------------------------
delete process.env.TRUST_PROXY_HEADERS;

// getSocketIp reads the header back plainly.
expectEqual(
  "socket.readsHeader",
  getSocketIp(headersWith({ [SOCKET_IP_HEADER]: "203.0.113.20" })),
  "203.0.113.20",
);
expectEqual("socket.missingHeader.isNull", getSocketIp(headersWith({})), null);

// Untrusted + no forwarded headers, but the socket header IS present (the
// normal case for a real, cookie-less request) → keyed on the real socket
// address, never the bare "unknown" literal.
expectEqual(
  "untrusted.usesSocketIpFallback",
  getClientIp(headersWith({ [SOCKET_IP_HEADER]: "203.0.113.20" })),
  "socket:203.0.113.20",
);

// A visitor-supplied X-Forwarded-For is still ignored when untrusted, even
// alongside a real socket address — the socket address wins.
expectEqual(
  "untrusted.socketIpOverridesSpoofedXff",
  getClientIp(
    headersWith({
      "x-forwarded-for": "9.9.9.9",
      [SOCKET_IP_HEADER]: "203.0.113.20",
    }),
  ),
  "socket:203.0.113.20",
);

// Two DIFFERENT real sources land in two DIFFERENT buckets — this is the
// exact guarantee the buyer-enquiry limiter (`enquiry:anon:ip:${...}`) and
// the login limiter both depend on: a cookie-dropping flood from one source
// bounds only that source's own bucket, never every first-time visitor's.
const sourceA = getClientIp(headersWith({ [SOCKET_IP_HEADER]: "203.0.113.20" }));
const sourceB = getClientIp(headersWith({ [SOCKET_IP_HEADER]: "198.51.100.7" }));
expectEqual("untrusted.twoSources.notEqual", sourceA === sourceB, false);
expectEqual(
  "untrusted.twoSources.enquiryKeysDiffer",
  `enquiry:anon:ip:${sourceA}` === `enquiry:anon:ip:${sourceB}`,
  false,
);

// Only when there is truly no signal at all (no trusted proxy header, no
// socket header — e.g. a bare Headers built directly in a test, bypassing a
// real HTTP server) does it fall back to the literal "unknown".
expectEqual("untrusted.noSocketIp.fallsBackToUnknown", getClientIp(headersWith({})), "unknown");

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll rate-limit tests passed.");
