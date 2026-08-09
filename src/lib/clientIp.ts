// Split out of rate-limit.ts (which is "server-only" because of its stateful
// in-memory store) so this pure, side-effect-free function can be unit
// tested directly with `tsx` — importing a "server-only" module outside of
// Next's own bundler throws. Re-exported from rate-limit.ts so every
// existing `import { getClientIp } from "@/lib/rate-limit"` keeps working.

// ---------------------------------------------------------------------------
// Real socket IP (server-trusted, never client-set) — the fallback for a
// cookie-less anonymous caller when TRUST_PROXY_HEADERS is off.
//
// src/instrumentation-node.ts subscribes to Node's `diagnostics_channel` on
// every incoming request and stamps the TRUE TCP peer address onto this
// header BEFORE Next.js — or any client-controlled code — ever reads the
// request. That assignment unconditionally OVERWRITES whatever a caller sent
// under this header name, so it can never be spoofed the way
// `X-Forwarded-For` can. getSocketIp() below just reads it back. This is a
// server-to-server signal, not something callers are meant to set — never
// trust it outside of a request that actually went through that subscriber
// (see the null fallback below, used by e.g. unit tests that build a bare
// `Headers` object without a real HTTP server behind it).
// ---------------------------------------------------------------------------

export const SOCKET_IP_HEADER = "x-opip-internal-socket-ip";

/**
 * The real socket-level source address for this request, or null when the
 * instrumentation subscriber never ran (e.g. a bare `Headers` built directly
 * in a unit test, bypassing the real HTTP server).
 */
export function getSocketIp(headers: Headers): string | null {
  const value = headers.get(SOCKET_IP_HEADER);
  return value && value.trim() ? value.trim() : null;
}

/**
 * The visitor's IP from `x-forwarded-for` (first hop) or `x-real-ip`, but
 * ONLY when TRUST_PROXY_HEADERS=true says a trusted proxy is in front of the
 * app. `X-Forwarded-For`/`X-Real-Ip` are set by the VISITOR's own request
 * unless a reverse proxy overwrites them — trusting them blindly lets
 * anyone dodge the per-IP limiter by sending a fake header
 * (`X-Forwarded-For: 1.2.3.4`) with every request. TRUST_PROXY_HEADERS
 * should only ever be true when the app is deployed behind a proxy that
 * itself sets/overwrites the header (e.g. Railway's edge network), never
 * when a client can reach the app directly. See .env.example.
 *
 * When the proxy headers are NOT trusted, we don't fall back to the bare
 * literal "unknown" — every cookie-less caller (curl, a bot, a browser that
 * drops our cookie) would then share ONE shared rate-limit bucket, so a
 * cookie-dropping flood from anywhere could exhaust it and block every other
 * visitor's first request (a platform-wide DoS — this is what the buyer
 * enquiry limiter hit). Instead we fall back to the real TCP socket address
 * (see SOCKET_IP_HEADER above), which is stamped onto every request by the
 * instrumentation subscriber and can't be spoofed by the caller. Only when
 * that signal is unavailable too (e.g. a bare `Headers` in a test) do we
 * return the literal "unknown".
 *
 * Read from `process.env` on every call (not cached at module load) so
 * tests can flip it and so a runtime env change takes effect without a
 * restart-order dependency.
 */
export function getClientIp(headers: Headers): string {
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }

  const socketIp = getSocketIp(headers);
  if (socketIp) return `socket:${socketIp}`;

  return "unknown";
}
