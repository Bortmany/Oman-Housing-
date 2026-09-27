// Pure escalating-backoff math for the login route, split out of auth.ts so
// it stays unit-testable with plain `tsx` (auth.ts pulls in next-auth/Prisma,
// which don't run outside Next's own bundler).
//
// The guarantee this protects: a WRONG password past the per-email/per-IP
// limit gets an increasing delay before rejection (slowing down automated
// brute-forcing), but this module only ever computes a DELAY for a miss —
// it is never consulted for a correct password, which auth.ts always admits
// immediately. See the comment above the `ok` check in auth.ts.

export type LoginRateLimitCount = {
  /** hits recorded for this key inside the current window (incl. this one) */
  count: number;
  /** max hits allowed inside the window, for this key */
  limit: number;
};

/**
 * How many wrong guesses PAST the limit this hit is (0 = the first denial),
 * taking whichever of the IP or email bucket is further over its own limit.
 */
export function computeOvershoot(
  byIp: LoginRateLimitCount,
  byEmail: LoginRateLimitCount,
): number {
  return Math.max(
    byIp.count - byIp.limit - 1,
    byEmail.count - byEmail.limit - 1,
    0,
  );
}

/**
 * Delay (ms) to hold a wrong-password rejection for, given how far over the
 * limit this guess is. Doubles per guess past the first denial, capped at
 * `maxMs` so a real (if very unlucky) request never hangs indefinitely.
 */
export function computeLoginBackoffMs(
  overshoot: number,
  baseMs: number,
  maxMs: number,
): number {
  return Math.min(maxMs, baseMs * 2 ** overshoot);
}
