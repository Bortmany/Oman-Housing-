// The rules for listings that private owners and agencies share — pure
// functions only (no database, no network), so they run in the browser form,
// in the server actions and in the tests (rules.test.ts) the same way.
//
// What lives here:
//   - who owns a listing (ownsListing) and the same rule as a database filter
//   - the form's checks, returning EVERY failing box (not just the first)
//   - what may happen to a listing's status (the state table)
//   - "edit returns to review"
//   - the public-property rule: unreviewed content is never public
//   - photo ordering (the first photo is the cover)
//
// The database half is core.ts; the screens call it through thin server actions.

import type { ListingStatus, Prisma } from "@prisma/client";

// ---------- Limits ----------

/** Live + in-review listings one private owner may have at once. */
export const OWNER_LISTING_CAP = 3;
/** Unfinished drafts (never counted against the cap, never public). */
export const OWNER_DRAFT_CAP = 3;
export const AGENCY_DRAFT_CAP = 10;
export const MAX_PHOTOS = 15;
/** Shown in the photo hint ("5 MB each"). The real limit is MAX_IMAGE_BYTES in storage.ts. */
export const PHOTO_MAX_MB = 5;
/** How long the admin's rejection note may be. */
export const REVIEW_NOTE_MAX = 300;

/** Statuses that occupy one of the owner's slots. */
export const IN_PLAY_STATUSES: ListingStatus[] = ["PENDING_REVIEW", "ACTIVE"];

/** What the listing says about itself (house rule 1). Never VERIFIED. */
export const OWNER_SOURCE_NOTE = "Submitted by a private owner";
export const SUBMITTED_CONFIDENCE = 0.5;

// ---------- Who owns a listing ----------

/** The person acting. An owner has no agency; an agency user has one. */
export type Actor = { userId: string; agencyId: string | null };

/**
 * The single ownership rule. An agency actor owns the listings of their
 * agency. An owner actor (no agency) owns listings with no agency that they
 * created. Nothing else counts — a listing an admin entered belongs to nobody.
 */
export function ownsListing(
  actor: Actor,
  listing: { agencyId: string | null; createdById: string },
): boolean {
  if (actor.agencyId) return listing.agencyId === actor.agencyId;
  return listing.agencyId == null && listing.createdById === actor.userId;
}

/** The same rule as a Prisma filter (so a query never loads then checks). */
export function ownershipWhere(actor: Actor): Prisma.ListingWhereInput {
  return actor.agencyId
    ? { agencyId: actor.agencyId }
    : { agencyId: null, createdById: actor.userId };
}

// ---------- The form's boxes ----------

export const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;
export const OWNERSHIP = ["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"] as const;

/** Every text box the form sends, by name. */
export const LISTING_FIELDS = [
  "neighborhoodId", "type", "ownership", "titleEn", "titleAr",
  "descriptionEn", "descriptionAr", "bedrooms", "bathrooms", "areaSqm",
  "yearBuilt", "listingType", "price", "rentPeriod",
] as const;
export type ListingField = (typeof LISTING_FIELDS)[number];

/** What the browser sends: text, keyed by box name. */
export type ListingValues = Partial<Record<ListingField, string>>;

export type FieldErrorKey =
  | "required"
  | "pricePositive"
  | "number"
  | "yearRange"
  | "tooLong"
  | "invalidChoice";

export type FieldError = { key: FieldErrorKey; max?: number };
export type FieldErrors = Partial<Record<ListingField, FieldError>>;

/** A listing's content once checked and tidied — what gets stored. */
export type ListingContent = {
  neighborhoodId: string;
  type: (typeof PROPERTY_TYPES)[number];
  ownership: (typeof OWNERSHIP)[number];
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  yearBuilt: number | null;
  listingType: "SALE" | "RENT";
  price: number;
  rentPeriod: "MONTHLY" | "ANNUAL" | null;
};

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 5000;
const MAX_PRICE = 999_999_999;

/** Latin digits from whatever was typed (Arabic-Indic too); commas/spaces dropped. */
export function toLatinNumber(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫]/g, ".")
    .replace(/[,٬\s]/g, "");
}

function parseNumber(raw: string | undefined): number | null | "bad" {
  const s = toLatinNumber((raw ?? "").trim());
  if (s === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return "bad";
  const n = Number(s);
  return Number.isFinite(n) ? n : "bad";
}

/**
 * Check every box and report ALL the ones that fail (the old form told you
 * only about the first). Dropdown choices are checked against the real lists.
 */
export function validateListingValues(
  raw: ListingValues,
): { ok: true; data: ListingContent } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const text = (k: ListingField) => (raw[k] ?? "").trim();

  const neighborhoodId = text("neighborhoodId");
  if (!neighborhoodId) errors.neighborhoodId = { key: "required" };
  else if (neighborhoodId.length > 64) errors.neighborhoodId = { key: "invalidChoice" };

  const type = text("type");
  if (!type) errors.type = { key: "required" };
  else if (!(PROPERTY_TYPES as readonly string[]).includes(type)) errors.type = { key: "invalidChoice" };

  const ownership = text("ownership") || "UNKNOWN";
  if (!(OWNERSHIP as readonly string[]).includes(ownership)) errors.ownership = { key: "invalidChoice" };

  const titleEn = text("titleEn");
  if (!titleEn) errors.titleEn = { key: "required" };
  else if (titleEn.length > MAX_TITLE) errors.titleEn = { key: "tooLong", max: MAX_TITLE };
  const titleAr = text("titleAr");
  if (titleAr.length > MAX_TITLE) errors.titleAr = { key: "tooLong", max: MAX_TITLE };

  const descriptionEn = text("descriptionEn");
  if (descriptionEn.length > MAX_DESCRIPTION) errors.descriptionEn = { key: "tooLong", max: MAX_DESCRIPTION };
  const descriptionAr = text("descriptionAr");
  if (descriptionAr.length > MAX_DESCRIPTION) errors.descriptionAr = { key: "tooLong", max: MAX_DESCRIPTION };

  const whole = (k: "bedrooms" | "bathrooms"): number | null => {
    const n = parseNumber(raw[k]);
    if (n === "bad" || (n !== null && (!Number.isInteger(n) || n < 0 || n > 50))) {
      errors[k] = { key: "number" };
      return null;
    }
    return n;
  };
  const bedrooms = whole("bedrooms");
  const bathrooms = whole("bathrooms");

  let areaSqm: number | null = null;
  const area = parseNumber(raw.areaSqm);
  if (area === "bad" || (area !== null && (area <= 0 || area > 10_000_000))) errors.areaSqm = { key: "number" };
  else areaSqm = area;

  let yearBuilt: number | null = null;
  const year = parseNumber(raw.yearBuilt);
  if (year === "bad" || (year !== null && !Number.isInteger(year))) errors.yearBuilt = { key: "number" };
  else if (year !== null && (year < 1900 || year > 2100)) errors.yearBuilt = { key: "yearRange" };
  else yearBuilt = year;

  const listingType = text("listingType");
  if (!listingType) errors.listingType = { key: "required" };
  else if (listingType !== "SALE" && listingType !== "RENT") errors.listingType = { key: "invalidChoice" };

  let price = 0;
  const p = parseNumber(raw.price);
  if (p === null) errors.price = { key: "required" };
  else if (p === "bad") errors.price = { key: "number" };
  else if (p <= 0 || p > MAX_PRICE) errors.price = { key: "pricePositive" };
  else price = Math.round(p * 1000) / 1000;

  const period = text("rentPeriod");
  let rentPeriod: "MONTHLY" | "ANNUAL" | null = null;
  if (listingType === "RENT") {
    if (period === "" || period === "MONTHLY") rentPeriod = "MONTHLY";
    else if (period === "ANNUAL") rentPeriod = "ANNUAL";
    else errors.rentPeriod = { key: "invalidChoice" };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      neighborhoodId,
      type: type as ListingContent["type"],
      ownership: ownership as ListingContent["ownership"],
      titleEn,
      titleAr: titleAr || null,
      descriptionEn: descriptionEn || null,
      descriptionAr: descriptionAr || null,
      bedrooms,
      bathrooms,
      areaSqm,
      yearBuilt,
      listingType: listingType as "SALE" | "RENT",
      price,
      rentPeriod,
    },
  };
}

/** The text the browser sent, handed back with a rejection (long text trimmed). */
export function echoValues(raw: ListingValues): ListingValues {
  const out: ListingValues = {};
  for (const k of LISTING_FIELDS) {
    const v = raw[k];
    if (typeof v === "string" && v !== "") out[k] = v.slice(0, MAX_DESCRIPTION);
  }
  return out;
}

// ---------- Edit returns to review ----------

/** The saved fields that make up "content" for the comparison. */
export type SavedContent = {
  neighborhoodId: string;
  type: string;
  ownership: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  yearBuilt: number | null;
  listingType: string;
  price: number;
  rentPeriod: string | null;
};

const blank = (v: string | null | undefined) => (v ?? "").trim();

/** True when the new content differs from what is saved (a no-change save is not a change). */
export function contentChanged(prev: SavedContent, next: ListingContent): boolean {
  return (
    prev.neighborhoodId !== next.neighborhoodId ||
    prev.type !== next.type ||
    prev.ownership !== next.ownership ||
    blank(prev.titleEn) !== next.titleEn ||
    blank(prev.titleAr) !== blank(next.titleAr) ||
    blank(prev.descriptionEn) !== blank(next.descriptionEn) ||
    blank(prev.descriptionAr) !== blank(next.descriptionAr) ||
    (prev.bedrooms ?? null) !== next.bedrooms ||
    (prev.bathrooms ?? null) !== next.bathrooms ||
    (prev.areaSqm ?? null) !== next.areaSqm ||
    (prev.yearBuilt ?? null) !== next.yearBuilt ||
    prev.listingType !== next.listingType ||
    Number(prev.price) !== next.price ||
    (next.listingType === "RENT" ? (prev.rentPeriod ?? null) !== next.rentPeriod : false)
  );
}

/**
 * Status after saving the form. A live listing whose content changed goes back
 * to review (nothing unreviewed may stay public); everything else keeps its
 * state. A no-change save leaves a live listing live.
 */
export function statusAfterSave(status: ListingStatus, changed: boolean): ListingStatus {
  return status === "ACTIVE" && changed ? "PENDING_REVIEW" : status;
}

/** A photo added (or described) on a live listing is new content: back to review. */
export function statusAfterPhotoAdded(status: ListingStatus): ListingStatus {
  return status === "ACTIVE" ? "PENDING_REVIEW" : status;
}

// ---------- The state table ----------

/** Statuses from which a listing may be sent (or sent again) for review. */
export const SENDABLE_STATUSES: ListingStatus[] = ["DRAFT", "REJECTED", "ARCHIVED", "SOLD", "RENTED"];

export function canSendForReview(status: ListingStatus): boolean {
  return SENDABLE_STATUSES.includes(status);
}

export type TakeDownReason = "SOLD" | "RENTED" | "WITHDRAW";

/**
 * Where a listing goes when taken off the site, or null if that is not allowed.
 * ACTIVE -> ARCHIVED / SOLD (sale only) / RENTED (rent only);
 * PENDING_REVIEW -> ARCHIVED (withdraw only: it was never live).
 */
export function takeDownStatus(
  status: ListingStatus,
  listingType: "SALE" | "RENT",
  reason: TakeDownReason,
): ListingStatus | null {
  if (status === "PENDING_REVIEW") return reason === "WITHDRAW" ? "ARCHIVED" : null;
  if (status !== "ACTIVE") return null;
  if (reason === "WITHDRAW") return "ARCHIVED";
  if (reason === "SOLD") return listingType === "SALE" ? "SOLD" : null;
  if (reason === "RENTED") return listingType === "RENT" ? "RENTED" : null;
  return null;
}

/** Only a draft can be deleted (nothing else was ever shown to anyone). */
export function canDeleteDraft(status: ListingStatus): boolean {
  return status === "DRAFT";
}

// ---------- Caps ----------

export function ownerHasSlot(inPlayCount: number): boolean {
  return inPlayCount < OWNER_LISTING_CAP;
}

export function draftCapFor(actor: Actor): number {
  return actor.agencyId ? AGENCY_DRAFT_CAP : OWNER_DRAFT_CAP;
}

export function underDraftCap(actor: Actor, draftCount: number): boolean {
  return draftCount < draftCapFor(actor);
}

/** "Owner's first listing": the owner has never had a listing published. */
export function isOwnersFirstListing(publishedBeforeCount: number): boolean {
  return publishedBeforeCount === 0;
}

// ---------- Never public until reviewed ----------

/**
 * Is a property allowed on any public page? Yes when it has NO listings (the
 * admin's reference records, as before) or at least one live listing. A
 * property whose listings are all pending, rejected, withdrawn, sold, rented
 * or draft is not public.
 */
export function isPropertyPublic(listingStatuses: ListingStatus[]): boolean {
  return listingStatuses.length === 0 || listingStatuses.includes("ACTIVE");
}

/** The same rule as a Prisma filter for Property queries. */
export const publicPropertyWhere = {
  OR: [{ listings: { none: {} } }, { listings: { some: { status: "ACTIVE" } } }],
} satisfies Prisma.PropertyWhereInput;

// ---------- Photos ----------

export type PhotoMove = "earlier" | "later" | "cover";

/** New order of photo ids after moving one. The first id is the cover. */
export function reorderIds(ids: string[], imageId: string, move: PhotoMove): string[] | null {
  const i = ids.indexOf(imageId);
  if (i === -1) return null;
  const next = [...ids];
  if (move === "cover") {
    next.splice(i, 1);
    next.unshift(imageId);
  } else {
    const j = move === "earlier" ? i - 1 : i + 1;
    if (j < 0 || j >= next.length) return next;
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** True when `proposed` is exactly the same set of ids as `current` (no extras, no missing, no repeats). */
export function isSameIdSet(current: string[], proposed: string[]): boolean {
  if (current.length !== proposed.length) return false;
  const set = new Set(proposed);
  if (set.size !== proposed.length) return false;
  return current.every((id) => set.has(id));
}

/** Owners must keep at least one photo on a listing that is in review or live. */
export function mayRemoveLastPhoto(actor: Actor, status: ListingStatus): boolean {
  if (actor.agencyId) return true;
  return status !== "PENDING_REVIEW" && status !== "ACTIVE";
}
