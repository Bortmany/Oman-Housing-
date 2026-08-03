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
// Anonymous rate-limit key — the fix for the shared-"unknown"-bucket finding.
//
// getClientIp() above returns the real IP only when TRUST_PROXY_HEADERS=true.
// With it off (the default — no trusted proxy in front of the app), every
// anonymous visitor gets "unknown", which means EVERY visitor's login/signup
// attempts count against the exact same bucket: one abusive visitor (or one
// buggy script) can exhaust it and lock out login/signup for every other
// real visitor at the same time — a platform-wide denial of service.
//
// Fix: when we cannot trust the IP, hand each browser a random id in a
// signed, httpOnly cookie the first time we see it (mint+sign logic lives in
// anonId.ts, kept pure/testable) and key the bucket on that id instead. Only
// the single request that arrives BEFORE the browser has the cookie falls
// back to "unknown" — every request after that gets its own bucket.
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
 * The key to use when rate-limiting an anonymous visitor (login/signup by
 * IP). Prefer the real IP when TRUST_PROXY_HEADERS=true; otherwise fall back
 * to a stable per-browser cookie id so anonymous traffic isn't all lumped
 * into one shared bucket. See the block comment above for why.
 */
export async function getAnonRateLimitKey(): Promise<string> {
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    return getRawClientIp(await headers());
  }

  if (process.env.NODE_ENV === "production" && !warnedNoTrustProxyInProd) {
    warnedNoTrustProxyInProd = true;
    console.warn(
      "[rate-limit] TRUST_PROXY_HEADERS is not set to \"true\" in production. " +
        "Anonymous login/signup rate limiting is falling back to a per-browser " +
        "cookie instead of the real visitor IP. If this app IS behind a trusted " +
        "proxy that overwrites X-Forwarded-For (e.g. Railway's edge network), " +
        "set TRUST_PROXY_HEADERS=true so limits key on the real IP instead. " +
        "See .env.example.",
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // No secret to sign the cookie with (misconfigured env) — fail safe to
    // the shared bucket rather than throwing during login/signup.
    return "unknown";
  }

  const jar = await cookies();
  const existingId = verifySignedAnonId(
    jar.get(ANON_COOKIE_NAME)?.value,
    secret,
  );
  if (existingId) return `browser:${existingId}`;

  const { cookieValue } = mintSignedAnonId(secret);
  jar.set(ANON_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE_S,
  });
  // This request has no cookie yet — the browser won't send it back until
  // the NEXT request, so this one request still shares the small "unknown"
  // bucket rather than one keyed on the id we just minted.
  return "unknown";
}
