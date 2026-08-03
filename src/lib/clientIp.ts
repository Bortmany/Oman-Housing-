// Split out of rate-limit.ts (which is "server-only" because of its stateful
// in-memory store) so this pure, side-effect-free function can be unit
// tested directly with `tsx` — importing a "server-only" module outside of
// Next's own bundler throws. Re-exported from rate-limit.ts so every
// existing `import { getClientIp } from "@/lib/rate-limit"` keeps working.

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
 * Read from `process.env` on every call (not cached at module load) so
 * tests can flip it and so a runtime env change takes effect without a
 * restart-order dependency.
 */
export function getClientIp(headers: Headers): string {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "unknown";

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
