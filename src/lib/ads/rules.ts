// Ad rules (pure: no database, no Next). Tested in rules.test.ts.
//
// Ads are sold directly. The rules that matter most are here so they can be
// tested without a browser:
//   - an ad is shown only inside its dates, only while switched on, and only
//     in its own slot (and, for the per-area slots, its own neighbourhood);
//   - whatever is shown always carries the "Ad · إعلان" label;
//   - the link can only ever be an https address.

export const AD_SLOTS = [
  "HOME_BAND",
  "MARKET_SIDEBAR",
  "PROPERTY_BELOW_FINANCIALS",
  "NEIGHBORHOOD_SPONSOR",
] as const;
export type AdSlotName = (typeof AD_SLOTS)[number];

/** The label every ad carries, in both languages on both language pages. */
export const AD_LABEL = "Ad · إعلان";

export const AD_SLOT_INFO: Record<AdSlotName, { perArea: boolean; size: string; ratio: string }> = {
  HOME_BAND: { perArea: false, size: "1600×400", ratio: "4 / 1" },
  MARKET_SIDEBAR: { perArea: false, size: "600×500", ratio: "6 / 5" },
  PROPERTY_BELOW_FINANCIALS: { perArea: true, size: "1200×300", ratio: "4 / 1" },
  NEIGHBORHOOD_SPONSOR: { perArea: true, size: "1200×200", ratio: "6 / 1" },
};

export function isAdSlot(v: unknown): v is AdSlotName {
  return typeof v === "string" && (AD_SLOTS as readonly string[]).includes(v);
}

// ---------- Link ----------

export const MAX_LINK_LENGTH = 500;

/** The link, normalised, if it is a plain https address; otherwise null. */
export function parseAdLink(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > MAX_LINK_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname || !url.hostname.includes(".")) return null;
  return url.toString();
}

// ---------- Time ----------

const OMAN_OFFSET_MS = 4 * 3600 * 1000; // UTC+4, no daylight saving

/** The Oman calendar day of a moment, as a Date at UTC midnight (what `@db.Date` stores). */
export function omanDay(at: Date): Date {
  const shifted = new Date(at.getTime() + OMAN_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** "2026-10-10T09:00" typed in a date-time box, meaning Oman time -> the real moment. */
export function parseOmanLocal(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi) - OMAN_OFFSET_MS;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  // Reject things like 31 February that JavaScript silently rolls over.
  const back = new Date(ms + OMAN_OFFSET_MS);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return date;
}

/** A moment -> the "YYYY-MM-DDTHH:mm" a date-time box wants, in Oman time. */
export function toOmanLocalInput(at: Date): string {
  return new Date(at.getTime() + OMAN_OFFSET_MS).toISOString().slice(0, 16);
}

// ---------- Which campaign is showing ----------

export type CampaignLike = {
  id: string;
  slot: AdSlotName;
  neighborhoodId: string | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
};

/** Switched on and `startsAt <= now < endsAt`. */
export function isCampaignLive(c: Pick<CampaignLike, "startsAt" | "endsAt" | "isActive">, now: Date): boolean {
  return c.isActive && c.startsAt.getTime() <= now.getTime() && now.getTime() < c.endsAt.getTime();
}

export type CampaignStatus = "scheduled" | "live" | "ended" | "paused";

export function campaignStatus(c: Pick<CampaignLike, "startsAt" | "endsAt" | "isActive">, now: Date): CampaignStatus {
  if (!c.isActive) return "paused";
  if (now.getTime() < c.startsAt.getTime()) return "scheduled";
  if (now.getTime() >= c.endsAt.getTime()) return "ended";
  return "live";
}

/**
 * The one campaign to show in a slot, or null. A per-area slot matches its own
 * neighbourhood only (never falls back to another area's ad); a general slot
 * ignores the neighbourhood. If data ever holds two live ones, the earliest
 * started wins (stable).
 */
export function pickCampaign<T extends CampaignLike>(
  campaigns: T[],
  slot: AdSlotName,
  neighborhoodId: string | null | undefined,
  now: Date,
): T | null {
  const perArea = AD_SLOT_INFO[slot].perArea;
  const matches = campaigns
    .filter((c) => c.slot === slot && isCampaignLive(c, now))
    .filter((c) => (perArea ? !!neighborhoodId && c.neighborhoodId === neighborhoodId : true))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
  return matches[0] ?? null;
}

// ---------- What the page renders ----------

export type AdView = {
  id: string;
  slot: AdSlotName;
  /** Always "Ad · إعلان". */
  label: string;
  advertiser: string;
  imageSrc: string;
  alt: string;
  linkHint: string;
  /** "By {advertiser}" - shown on the neighbourhood strip only. */
  by: string | null;
  href: string;
  ratio: string;
};

export type AdViewText = { linkHint: string; by: string; altFallback: string };

export function buildAdView(
  c: {
    id: string;
    slot: AdSlotName;
    advertiser: string;
    altEn: string;
    altAr: string | null;
    imageEnPath: string;
    imageArPath: string | null;
  },
  locale: string,
  text: AdViewText,
): AdView {
  const arabic = locale === "ar";
  const imagePath = (arabic && c.imageArPath) || c.imageEnPath;
  const alt = ((arabic && c.altAr?.trim()) || c.altEn.trim()) || text.altFallback;
  return {
    id: c.id,
    slot: c.slot,
    label: AD_LABEL,
    advertiser: c.advertiser,
    imageSrc: `/api/images/${imagePath}`,
    alt,
    linkHint: text.linkHint,
    by: c.slot === "NEIGHBORHOOD_SPONSOR" ? text.by : null,
    href: `/api/ads/${c.id}/click`,
    ratio: AD_SLOT_INFO[c.slot].ratio,
  };
}

// ---------- Form checks ----------

export type CampaignInput = {
  advertiser: string;
  slot: string;
  neighborhoodId: string;
  linkUrl: string;
  altEn: string;
  altAr: string;
  startsAt: string;
  endsAt: string;
  agreedPrice: string;
};

export type CampaignFieldError = "required" | "neighborhood" | "link" | "dates" | "price";

export type ParsedCampaign = {
  advertiser: string;
  slot: AdSlotName;
  neighborhoodId: string | null;
  linkUrl: string;
  altEn: string;
  altAr: string | null;
  startsAt: Date;
  endsAt: Date;
  agreedPrice: string | null;
};

export function parseCampaignInput(
  input: CampaignInput,
): { ok: true; value: ParsedCampaign } | { ok: false; error: CampaignFieldError } {
  const advertiser = input.advertiser.trim();
  const altEn = input.altEn.trim();
  if (!advertiser || advertiser.length > 120 || !altEn || altEn.length > 200) return { ok: false, error: "required" };
  if (input.altAr.trim().length > 200) return { ok: false, error: "required" };
  if (!isAdSlot(input.slot)) return { ok: false, error: "required" };
  const slot = input.slot;
  const perArea = AD_SLOT_INFO[slot].perArea;
  const neighborhoodId = input.neighborhoodId.trim();
  if (perArea && !neighborhoodId) return { ok: false, error: "neighborhood" };
  const linkUrl = parseAdLink(input.linkUrl);
  if (!linkUrl) return { ok: false, error: "link" };
  const startsAt = parseOmanLocal(input.startsAt);
  const endsAt = parseOmanLocal(input.endsAt);
  if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: "dates" };

  let agreedPrice: string | null = null;
  const price = input.agreedPrice.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (price) {
    if (!/^\d{1,6}(\.\d{1,3})?$/.test(price)) return { ok: false, error: "price" };
    agreedPrice = price;
  }
  return {
    ok: true,
    value: {
      advertiser,
      slot,
      neighborhoodId: perArea ? neighborhoodId : null,
      linkUrl,
      altEn,
      altAr: input.altAr.trim() || null,
      startsAt,
      endsAt,
      agreedPrice,
    },
  };
}

/** Do two date ranges share any moment? (end is exclusive) */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** True if `candidate` collides with any of `others` (same slot, same area, overlapping dates, switched on). */
export function hasOverlap(
  candidate: { slot: AdSlotName; neighborhoodId: string | null; startsAt: Date; endsAt: Date; id?: string },
  others: Array<{ id: string; slot: AdSlotName; neighborhoodId: string | null; startsAt: Date; endsAt: Date; isActive: boolean }>,
): boolean {
  return others.some(
    (o) =>
      o.isActive &&
      o.id !== candidate.id &&
      o.slot === candidate.slot &&
      o.neighborhoodId === candidate.neighborhoodId &&
      rangesOverlap(candidate.startsAt, candidate.endsAt, o.startsAt, o.endsAt),
  );
}

// ---------- Counting ----------

const BOT = /bot|crawler|spider|preview|facebookexternalhit|whatsapp/i;

/** Crawlers and link-preview fetchers are not counted as views. A missing user agent is not counted either. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT.test(ua);
}

export function clickRatePercent(views: number, clicks: number): string | null {
  if (views <= 0) return null;
  return `${((clicks / views) * 100).toFixed(1)}%`;
}

/** "2026-10-03" (a stored Oman day) -> "2026-10". */
export function monthKey(day: Date): string {
  return day.toISOString().slice(0, 7);
}

export function monthlyTotals(
  rows: Array<{ day: Date; views: number; clicks: number }>,
): Array<{ month: string; views: number; clicks: number }> {
  const map = new Map<string, { views: number; clicks: number }>();
  for (const r of rows) {
    const k = monthKey(r.day);
    const cur = map.get(k) ?? { views: 0, clicks: 0 };
    cur.views += r.views;
    cur.clicks += r.clicks;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}
