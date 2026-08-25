// Rate-limit / IP-trust tests.
//
// Imports from clientIp.ts directly, not rate-limit.ts — rate-limit.ts is
// "server-only" (guards its stateful in-memory store), which throws when
// imported outside Next's own bundler; clientIp.ts is the same function
// rate-limit.ts re-exports, split out precisely so it stays unit-testable.
import { afterEach, describe, expect, test } from "vitest";
import { getClientIp, getSocketIp, SOCKET_IP_HEADER } from "@/lib/clientIp";

function headersWith(values: Record<string, string>): Headers {
  return new Headers(values);
}

afterEach(() => {
  delete process.env.TRUST_PROXY_HEADERS;
});

describe("TRUST_PROXY_HEADERS off (default)", () => {
  test("a visitor-supplied X-Forwarded-For / X-Real-Ip is ignored", () => {
    // Trusting it would let anyone spoof their way past the per-IP
    // login/signup limiter.
    delete process.env.TRUST_PROXY_HEADERS;
    expect(getClientIp(headersWith({ "x-forwarded-for": "9.9.9.9" }))).toBe("unknown");
    expect(getClientIp(headersWith({ "x-real-ip": "9.9.9.9" }))).toBe("unknown");
  });
});

describe("TRUST_PROXY_HEADERS=true (app is behind a proxy that overwrites these headers itself, e.g. Railway)", () => {
  test("the forwarded IP is used", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    expect(getClientIp(headersWith({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(getClientIp(headersWith({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(headersWith({}))).toBe("unknown");
  });
});

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
describe("socket-IP fallback (untrusted proxy headers)", () => {
  test("getSocketIp reads the header back plainly", () => {
    expect(getSocketIp(headersWith({ [SOCKET_IP_HEADER]: "203.0.113.20" }))).toBe("203.0.113.20");
    expect(getSocketIp(headersWith({}))).toBeNull();
  });

  test("untrusted + no forwarded headers, but the socket header IS present → keyed on the real socket address, never the bare \"unknown\" literal", () => {
    delete process.env.TRUST_PROXY_HEADERS;
    expect(getClientIp(headersWith({ [SOCKET_IP_HEADER]: "203.0.113.20" }))).toBe("socket:203.0.113.20");
  });

  test("a visitor-supplied X-Forwarded-For is still ignored when untrusted, even alongside a real socket address — the socket address wins", () => {
    delete process.env.TRUST_PROXY_HEADERS;
    expect(
      getClientIp(
        headersWith({
          "x-forwarded-for": "9.9.9.9",
          [SOCKET_IP_HEADER]: "203.0.113.20",
        }),
      ),
    ).toBe("socket:203.0.113.20");
  });

  test("two DIFFERENT real sources land in two DIFFERENT buckets", () => {
    // This is the exact guarantee the buyer-enquiry limiter
    // (`enquiry:anon:ip:${...}`) and the login limiter both depend on: a
    // cookie-dropping flood from one source bounds only that source's own
    // bucket, never every first-time visitor's.
    delete process.env.TRUST_PROXY_HEADERS;
    const sourceA = getClientIp(headersWith({ [SOCKET_IP_HEADER]: "203.0.113.20" }));
    const sourceB = getClientIp(headersWith({ [SOCKET_IP_HEADER]: "198.51.100.7" }));
    expect(sourceA === sourceB).toBe(false);
    expect(`enquiry:anon:ip:${sourceA}` === `enquiry:anon:ip:${sourceB}`).toBe(false);
  });

  test("only when there is truly no signal at all does it fall back to the literal \"unknown\"", () => {
    // No trusted proxy header, no socket header — e.g. a bare Headers built
    // directly in a test, bypassing a real HTTP server.
    delete process.env.TRUST_PROXY_HEADERS;
    expect(getClientIp(headersWith({}))).toBe("unknown");
  });
});
