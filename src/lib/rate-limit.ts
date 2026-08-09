import "server-only";

// ---------------------------------------------------------------------------
// Shared rate limiter — protects auth and write endpoints from abuse/floods.
//
// Two keys: by visitor IP (anonymous traffic) and by user id (signed-in
// traffic). A fixed time window counts hits per key; once the count passes the
// limit, further hits are denied with how many seconds to wait (retryAfter).
//
// STORE: in-memory for now (a single server instance). The Map is stashed on
// globalThis so it survives Next's dev hot-reloads and module re-evaluation.
// This means limits are PER PROCESS — if the app is ever run as several copies
// behind a load balancer, each copy keeps its own tally.
//
// REDIS SEAM: when REDIS_URL is set we should swap the in-memory store for a
// shared Redis store so every instance shares one tally. That switch lives
// behind the RateLimitStore interface below — no caller changes. We do NOT add
// a redis dependency until that store is actually wired; until then the app
// logs once that it is running with per-process limits.
// ---------------------------------------------------------------------------

export type RateLimitResult = {
  /** true = let the request through; false = deny with 429-style handling */
  allowed: boolean;
  /** seconds the caller should wait before trying again (only when denied) */
  retryAfter: number;
  /** hits recorded for this key inside the current window (incl. this one) */
  count: number;
};

type Bucket = { count: number; resetAt: number };

interface RateLimitStore {
  /** Record one hit for `key` and report whether it is now over `limit`. */
  hit(key: string, limit: number, windowMs: number): RateLimitResult;
}

/** In-memory fixed-window store. Fine for one instance; see REDIS SEAM above. */
class MemoryStore implements RateLimitStore {
  constructor(private readonly buckets: Map<string, Bucket>) {}

  hit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.sweep(now);
      return { allowed: true, retryAfter: 0, count: 1 };
    }

    existing.count += 1;
    if (existing.count > limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        count: existing.count,
      };
    }
    return { allowed: true, retryAfter: 0, count: existing.count };
  }

  /** Occasionally drop expired buckets so the Map cannot grow unbounded. */
  private sweep(now: number) {
    if (this.buckets.size < 5000) return;
    for (const [k, b] of this.buckets) {
      if (b.resetAt <= now) this.buckets.delete(k);
    }
  }
}

// globalThis-guarded singletons so state persists across hot-reloads.
const globalForRateLimit = globalThis as unknown as {
  __rateLimitBuckets?: Map<string, Bucket>;
  __rateLimitWarned?: boolean;
};

const buckets =
  globalForRateLimit.__rateLimitBuckets ??
  (globalForRateLimit.__rateLimitBuckets = new Map<string, Bucket>());

const store: RateLimitStore = new MemoryStore(buckets);

if (process.env.REDIS_URL && !globalForRateLimit.__rateLimitWarned) {
  // REDIS_URL is set but no shared store is wired yet — say so once, loudly,
  // rather than silently running per-process limits under that expectation.
  globalForRateLimit.__rateLimitWarned = true;
  console.warn(
    "[rate-limit] REDIS_URL is set but the shared Redis store is not wired yet — limits are still per-process.",
  );
}

/** The pluggable store is Redis-backed only once that seam is implemented. */
export const isDistributedRateLimit = false;

export type RateLimitOptions = {
  /** max hits allowed inside the window */
  limit: number;
  /** window length in milliseconds */
  windowMs: number;
};

/**
 * Count one hit for `key` and decide allow/deny. `key` should already be
 * namespaced by the caller, e.g. `login:ip:1.2.3.4` or `favorite:user:abc`.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  return store.hit(key, limit, windowMs);
}

// Re-exported so existing callers keep writing
// `import { checkRateLimit, getClientIp } from "@/lib/rate-limit"` — the
// implementation moved to clientIp.ts (not "server-only") so it can be unit
// tested directly.
export { getClientIp } from "./clientIp";

// ---------------------------------------------------------------------------
// Anonymous rate-limit key — how we identify an unauthenticated visitor for
// the login/signup/enquiry limiters. Two signals, in priority order:
//
//   1. A COOKIE-BEARING client → its stable, signed per-browser id (minted
//      into a signed httpOnly cookie the first time we see it; sign/verify
//      logic lives in anonId.ts, kept pure/testable). The id is HMAC-signed
//      with AUTH_SECRET, so a script can't forge one or hop between buckets.
//   2. A COOKIE-LESS caller (a first-contact request, or a client that
//      deliberately ignores our cookie) → the REAL connection IP via
//      getClientIp(), which only trusts forwarded headers behind a trusted
//      proxy (TRUST_PROXY_HEADERS=true). We still hand this caller a cookie so
//      a genuine browser's NEXT request upgrades to signal #1.
//
// Why not the previous behaviour: it keyed a cookie-less request on a
// FRESHLY-MINTED per-request id. That silently disabled the limiter for any
// client that ignores cookies — every request got a brand-new empty bucket,
// so a flood could never trip the limit. Keying cookie-less callers on their
// IP instead means an abuser who won't hold a cookie is bounded by their IP
// bucket, and we never return a fresh-per-request id or a bare "unknown"
// literal as the whole key.
//
// This import lives here (not clientIp.ts) specifically because it needs
// `cookies()`/`headers()` from next/headers, which only work inside Next's
// own request handling — clientIp.ts stays free of that so it keeps working
// under plain `tsx` for its unit tests.
// ---------------------------------------------------------------------------
import { cookies, headers } from "next/headers";
import { mintSignedAnonId, verifySignedAnonId } from "./anonId";
import { getClientIp as getRawClientIp } from "./clientIp";

const ANON_COOKIE_NAME = "opip_anon";
const ANON_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year

let warnedNoTrustProxyInProd = false;

/**
 * The key to use when rate-limiting an anonymous visitor. Cookie-bearing
 * clients get their stable per-browser id; cookie-less callers are keyed on
 * the real connection IP (never a fresh-minted-per-request id, never a bare
 * "unknown" bucket). See the block comment above for the full rationale.
 */
export async function getAnonRateLimitKey(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  const jar = secret ? await cookies() : null;

  // 1. Cookie-bearing client → its stable, forgery-proof per-browser id.
  if (secret && jar) {
    const existingId = verifySignedAnonId(
      jar.get(ANON_COOKIE_NAME)?.value,
      secret,
    );
    if (existingId) return `browser:${existingId}`;
  }

  // Warn once (in production) that without a trusted proxy the cookie-less
  // fallback below can only see "unknown" instead of a real IP.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TRUST_PROXY_HEADERS !== "true" &&
    !warnedNoTrustProxyInProd
  ) {
    warnedNoTrustProxyInProd = true;
    console.warn(
      "[rate-limit] TRUST_PROXY_HEADERS is not set to \"true\" in production. " +
        "Cookie-less anonymous callers are rate-limited on \"unknown\" instead " +
        "of their real IP. If this app IS behind a trusted proxy that overwrites " +
        "X-Forwarded-For (e.g. Railway's edge network), set TRUST_PROXY_HEADERS=" +
        "true so limits key on the real connecting IP. See .env.example.",
    );
  }

  // Hand a real browser a signed cookie so its NEXT request upgrades to the
  // stable per-browser key above. A client that never stores it stays pinned
  // to its IP bucket below — exactly what we want for abuse.
  if (secret && jar) {
    const { cookieValue } = mintSignedAnonId(secret);
    jar.set(ANON_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ANON_COOKIE_MAX_AGE_S,
    });
  }

  // 2. Cookie-less caller → the real connection IP (or "unknown" only when we
  // genuinely have no trustworthy IP). Namespaced so it can never collide with
  // a `browser:` key.
  return `ip:${getRawClientIp(await headers())}`;
}
