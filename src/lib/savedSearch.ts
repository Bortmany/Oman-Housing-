// Saved-search rules shared by the "save this search" button, the server
// action and the account page. Pure functions, no I/O.

/** The only query parameters the property search understands. */
export const SEARCH_PARAMS = [
  "hood",
  "type",
  "listingType",
  "minPrice",
  "maxPrice",
  "beds",
  "ownership",
] as const;

export type SearchParam = (typeof SEARCH_PARAMS)[number];

/** How often someone wants to hear about new matches, once email is live. */
export const FREQUENCIES = ["instant", "daily"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const DEFAULT_FREQUENCY: Frequency = "daily";

/** One person can keep this many searches — a sane ceiling, not a paid limit. */
export const MAX_SAVED_SEARCHES = 25;

/** Longest value we accept for any single filter (a slug or an enum name). */
const MAX_VALUE_LENGTH = 64;

/**
 * Keep only the parameters the search page actually reads, in a fixed order,
 * with sane lengths — so a hand-edited URL can never store junk (or a huge
 * string) under someone's account.
 */
export function normalizeSearchQuery(raw: string): string {
  const input = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const out = new URLSearchParams();
  for (const key of SEARCH_PARAMS) {
    const value = (input.get(key) ?? "").trim();
    if (value !== "" && value.length <= MAX_VALUE_LENGTH) out.append(key, value);
  }
  return out.toString();
}

/** The stored query string back as an object, ready for a locale-aware Link. */
export function searchQueryToObject(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const out: Record<string, string> = {};
  for (const key of SEARCH_PARAMS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

export function isFrequency(value: unknown): value is Frequency {
  return FREQUENCIES.includes(value as Frequency);
}
