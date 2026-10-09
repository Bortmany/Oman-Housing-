// Featured listings — the pure rules (no database, no Next.js), tested in
// featured.test.ts.
//
// A listing is "featured" while Listing.featuredUntil is in the future AND the
// listing is live. At most MAX_FEATURED_PER_PAGE featured listings lead one
// results page; when more qualify, which ones lead rotates every UTC hour by a
// fixed formula (fair between advertisers, and testable: no random call).
//
// Honesty: nothing in this file (or anywhere that reads featuredUntil) may
// touch a listing's provenance, confidence, status or price, and the estimate
// and AI-analyst code never mentions payments (tested in featured.test.ts).

/** The cap is a constant, not a setting. */
export const MAX_FEATURED_PER_PAGE = 3;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Whole UTC hours since 1970: the rotation changes when this number does. */
export function hourStamp(now: Date): number {
  return Math.floor(now.getTime() / HOUR_MS);
}

/** Featured right now? (An empty or past date is not featured.) */
export function isFeaturedNow(featuredUntil: Date | null | undefined, now: Date): boolean {
  return featuredUntil != null && featuredUntil.getTime() > now.getTime();
}

/**
 * The new end date after buying `days` days: the days are added after the
 * later of "now" and the current end date, so paying again never loses time.
 */
export function extendFeaturedUntil(
  current: Date | null | undefined,
  now: Date,
  days: number,
): Date {
  const start = current && current.getTime() > now.getTime() ? current.getTime() : now.getTime();
  return new Date(start + days * DAY_MS);
}

/** Small stable string hash (FNV-1a, 32 bit). */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Pick which featured listings lead this hour: only those still featured,
 * ordered by a stable hash of (listing id + hour), at most `max`. The same
 * inputs always give the same answer; a new hour reshuffles.
 */
export function pickFeatured<T extends { id: string; featuredUntil: Date | null }>(
  candidates: readonly T[],
  hour: number,
  max: number = MAX_FEATURED_PER_PAGE,
  now: Date = new Date(hour * HOUR_MS),
): T[] {
  const seen = new Set<string>();
  const live: T[] = [];
  for (const c of candidates) {
    if (seen.has(c.id) || !isFeaturedNow(c.featuredUntil, now)) continue;
    seen.add(c.id);
    live.push(c);
  }
  return live
    .map((c) => ({ c, key: fnv1a(`${c.id}:${hour}`) }))
    .sort((a, b) => a.key - b.key || (a.c.id < b.c.id ? -1 : 1))
    .slice(0, Math.max(0, max))
    .map((x) => x.c);
}
