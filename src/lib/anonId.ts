// Pure sign/verify helpers for the anonymous-visitor cookie (see
// getAnonRateLimitKey in rate-limit.ts). Split out — like clientIp.ts — so
// this logic can be unit tested directly with `tsx`, without pulling in
// "next/headers" (which only works inside Next's own request handling).
//
// Why a signed cookie at all: when TRUST_PROXY_HEADERS is off (the default),
// the app cannot tell visitors apart by IP (see clientIp.ts), so every
// anonymous visitor would otherwise share the single "unknown" rate-limit
// bucket — one abusive visitor could lock out everyone else's login/signup.
// Instead we hand each browser a random id in an httpOnly cookie the first
// time we see it, and sign that id with AUTH_SECRET so a script can't just
// invent its own id value and hop between buckets by rewriting the cookie.
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const ID_BYTES = 16;

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("hex");
}

/** Mint a fresh random id and its signature, ready to store in a cookie. */
export function mintSignedAnonId(secret: string): {
  id: string;
  cookieValue: string;
} {
  const id = randomBytes(ID_BYTES).toString("hex");
  return { id, cookieValue: `${id}.${sign(id, secret)}` };
}

/**
 * Verify a cookie value was minted by us (not tampered with). Returns the
 * id on success, or null if the cookie is missing, malformed, or its
 * signature doesn't match.
 */
export function verifySignedAnonId(
  cookieValue: string | undefined | null,
  secret: string,
): string | null {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!id || !sig) return null;

  const expected = sign(id, secret);
  let expectedBuf: Buffer;
  let sigBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, "hex");
    sigBuf = Buffer.from(sig, "hex");
  } catch {
    return null;
  }
  if (sigBuf.length !== expectedBuf.length) return null;
  return timingSafeEqual(sigBuf, expectedBuf) ? id : null;
}
