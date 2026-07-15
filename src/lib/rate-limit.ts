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
      return { allowed: true, retryAfter: 0 };
    }

    existing.count += 1;
    if (existing.count > limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }
    return { allowed: true, retryAfter: 0 };
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

/**
 * The visitor's IP from `x-forwarded-for` (first hop, behind the Railway
 * proxy), falling back to `x-real-ip`, then a constant so anonymous traffic
 * still shares a bucket rather than bypassing the limit entirely.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
