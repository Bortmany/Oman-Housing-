// Socket-IP diagnostics-channel stamping tests. Run with: npm test
//
// The pentest finding this covers: a cookie-less anonymous caller (curl, a
// bot, a browser that drops our cookie) used to share the single literal
// "unknown" rate-limit bucket with every other cookie-less caller — a
// buyer-enquiry flood from ANY one source could exhaust that shared bucket
// and block every other visitor's first enquiry. The fix keys a cookie-less
// caller on the real TCP socket address instead; this test proves the piece
// that makes that value trustworthy: the diagnostics subscriber always
// overwrites SOCKET_IP_HEADER with the genuine socket address, discarding
// anything a caller sent under that same header name.
import { stampSocketIpHeader } from "./instrumentation-node";
import { SOCKET_IP_HEADER } from "./lib/clientIp";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

function expectNoThrow(label: string, fn: () => void) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  expectEqual(label, threw, false);
}

// Stamps the socket's real remote address onto the header.
{
  const headers: Record<string, string | string[] | undefined> = {};
  stampSocketIpHeader({
    request: { headers },
    socket: { remoteAddress: "203.0.113.9" },
  });
  expectEqual("stamp.setsRealAddress", headers[SOCKET_IP_HEADER], "203.0.113.9");
}

// OVERWRITES a value the caller already sent under the same header name —
// this is what makes the header trustworthy (never client-spoofable).
{
  const headers: Record<string, string | string[] | undefined> = {
    [SOCKET_IP_HEADER]: "1.2.3.4 (attacker-forged)",
  };
  stampSocketIpHeader({
    request: { headers },
    socket: { remoteAddress: "203.0.113.9" },
  });
  expectEqual("stamp.overwritesForgedValue", headers[SOCKET_IP_HEADER], "203.0.113.9");
}

// Never throws on a missing/partial message shape (e.g. an odd diagnostics
// payload) — a throw here would crash every incoming request.
expectNoThrow("stamp.noThrow.emptyMessage", () => stampSocketIpHeader({}));
expectNoThrow("stamp.noThrow.nullMessage", () => stampSocketIpHeader(null));
expectNoThrow("stamp.noThrow.missingSocket", () =>
  stampSocketIpHeader({ request: { headers: {} }, socket: {} }),
);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll instrumentation-node tests passed.");
