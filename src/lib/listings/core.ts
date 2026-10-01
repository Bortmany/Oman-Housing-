// The listing actions' core — the database half of the shared rules in
// rules.ts. Private owners (now) and agencies (Build B) both call these
// through thin server actions that do the signed-in check and the rate limit.
//
// Every function takes the ACTOR and loads the listing with the ownership
// rule inside the query (id AND owner), so a listing that is not yours and a
// listing that does not exist give the same answer: "notFound". Photo actions
// find the photo through the listing's own property, never by image id alone.
//
// Nothing here knows about Next.js (no cache tags, no redirects) so the tests
// can run it directly against the test database.

import type { ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, savePropertyImage } from "@/lib/storage";
import { isPhoneVerified } from "@/lib/phoneVerify";
import { canAddListing } from "@/lib/tiers";
import {
  IN_PLAY_STATUSES,
  MAX_PHOTOS,
  OWNER_SOURCE_NOTE,
  SUBMITTED_CONFIDENCE,
  canDeleteDraft,
  canSendForReview,
  contentChanged,
  echoValues,
  isSameIdSet,
  mayRemoveLastPhoto,
  ownerHasSlot,
  ownershipWhere,
  reorderIds,
  statusAfterPhotoAdded,
  statusAfterSave,
  takeDownStatus,
  underDraftCap,
  validateListingValues,
  type Actor,
  type FieldErrors,
  type ListingValues,
  type PhotoMove,
  type TakeDownReason,
} from "./rules";

export type CoreError =
  | "notFound"
  | "wrongState"
  | "draftLimit"
  | "capReached"
  | "phoneNotVerified"
  | "validationFailed"
  | "photoLimit"
  | "photoSize"
  | "photoType"
  | "photoFailed"
  | "photoRequired"
  | "lastPhoto"
  | "confirmRequired";

export type Failure = {
  ok: false;
  error: CoreError;
  /** Every failing box (validationFailed only). */
  fieldErrors?: FieldErrors;
  /** What was typed, handed back so nothing is retyped. */
  values?: ListingValues;
  /** Used by draftLimit. */
  count?: number;
};

const fail = (error: CoreError, extra: Partial<Failure> = {}): Failure => ({
  ok: false,
  error,
  ...extra,
});

/** The listing with its property and photos — loaded only if the actor owns it. */
async function loadOwned(actor: Actor, listingId: string) {
  if (!listingId || listingId.length > 64) return null;
  return prisma.listing.findFirst({
    where: { id: listingId, ...ownershipWhere(actor) },
    include: {
      property: {
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          listings: { select: { id: true } },
        },
      },
    },
  });
}

type OwnedListing = NonNullable<Awaited<ReturnType<typeof loadOwned>>>;

async function ownerRow(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerifiedAt: true },
  });
}

// ---------- Save the text (creates the draft, or updates a listing) ----------

export type SaveResult =
  | { ok: true; listingId: string; status: ListingStatus; changed: boolean }
  | Failure;

export async function saveListing(
  actor: Actor,
  input: { listingId?: string | null; values: ListingValues },
): Promise<SaveResult> {
  const parsed = validateListingValues(input.values);
  const echoed = echoValues(input.values);
  if (!parsed.ok) {
    return fail("validationFailed", { fieldErrors: parsed.errors, values: echoed });
  }
  const d = parsed.data;

  // The neighbourhood must be a real one (a forged id is a failing box).
  const hood = await prisma.neighborhood.findUnique({
    where: { id: d.neighborhoodId },
    select: { id: true },
  });
  if (!hood) {
    return fail("validationFailed", {
      fieldErrors: { neighborhoodId: { key: "invalidChoice" } },
      values: echoed,
    });
  }

  const propertyData = {
    neighborhoodId: d.neighborhoodId,
    type: d.type,
    ownership: d.ownership,
    titleEn: d.titleEn,
    titleAr: d.titleAr,
    descriptionEn: d.descriptionEn,
    descriptionAr: d.descriptionAr,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    areaSqm: d.areaSqm,
    yearBuilt: d.yearBuilt,
  };
  const listingData = {
    listingType: d.listingType,
    price: d.price,
    rentPeriod: d.listingType === "RENT" ? (d.rentPeriod ?? "MONTHLY") : null,
  };

  // ----- Edit an existing listing -----
  if (input.listingId) {
    const existing = await loadOwned(actor, input.listingId);
    if (!existing) return fail("notFound");
    const p = existing.property;
    // Only a home that belongs to this listing alone, and that no admin has
    // verified, can be edited here (an edit must not rewrite a verified record).
    if (p.verifiedAt || p.listings.length > 1) return fail("wrongState");

    const changed = contentChanged(
      {
        neighborhoodId: p.neighborhoodId,
        type: p.type,
        ownership: p.ownership,
        titleEn: p.titleEn,
        titleAr: p.titleAr,
        descriptionEn: p.descriptionEn,
        descriptionAr: p.descriptionAr,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        areaSqm: p.areaSqm == null ? null : Number(p.areaSqm),
        yearBuilt: p.yearBuilt,
        listingType: existing.listingType,
        price: Number(existing.price),
        rentPeriod: existing.rentPeriod,
      },
      d,
    );
    const status = statusAfterSave(existing.status, changed);

    if (changed) {
      await prisma.$transaction([
        prisma.property.update({ where: { id: p.id }, data: propertyData }),
        prisma.listing.update({
          where: { id: existing.id },
          data: { ...listingData, status },
        }),
      ]);
    }
    return { ok: true, listingId: existing.id, status, changed };
  }

  // ----- Create a new draft -----
  let sourceNote = OWNER_SOURCE_NOTE;
  if (actor.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: actor.agencyId },
      select: { nameEn: true },
    });
    if (!agency) return fail("notFound");
    sourceNote = `Submitted by agency: ${agency.nameEn}`;
  } else {
    if (!isPhoneVerified(await ownerRow(actor.userId))) return fail("phoneNotVerified");
  }

  const drafts = await prisma.listing.count({
    where: { ...ownershipWhere(actor), status: "DRAFT" },
  });
  if (!underDraftCap(actor, drafts)) return fail("draftLimit", { count: drafts });

  // Never trusted from the browser: status, agency, creator, provenance.
  const created = await prisma.property.create({
    data: {
      ...propertyData,
      provenance: "USER_SUBMITTED",
      confidence: SUBMITTED_CONFIDENCE,
      sourceNote,
      listings: {
        create: {
          ...listingData,
          status: "DRAFT",
          agencyId: actor.agencyId,
          createdById: actor.userId,
          provenance: "USER_SUBMITTED",
          confidence: SUBMITTED_CONFIDENCE,
        },
      },
    },
    select: { listings: { select: { id: true } } },
  });
  return { ok: true, listingId: created.listings[0].id, status: "DRAFT", changed: true };
}

// ---------- Photos ----------

export type PhotoResult =
  | { ok: true; image: { id: string; path: string; altEn: string | null; altAr: string | null } }
  | Failure;

const MAX_ALT = 200;

/** Add one photo (one per request). The file's type is read from its own bytes. */
export async function addPhoto(
  actor: Actor,
  listingId: string,
  file: File,
  alt: { altEn?: string; altAr?: string } = {},
): Promise<PhotoResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  if (l.property.images.length >= MAX_PHOTOS) return fail("photoLimit");

  const saved = await savePropertyImage(l.propertyId, file);
  if ("error" in saved) return fail(saved.error === "size" ? "photoSize" : "photoType");

  try {
    const image = await prisma.$transaction(async (tx) => {
      // Lock this listing so two uploads at once cannot both slip past the cap.
      await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${l.id} FOR UPDATE`;
      const existing = await tx.propertyImage.findMany({
        where: { propertyId: l.propertyId },
        select: { sortOrder: true },
      });
      if (existing.length >= MAX_PHOTOS) throw new Error("PHOTO_LIMIT");
      const next = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;
      const row = await tx.propertyImage.create({
        data: {
          propertyId: l.propertyId,
          storagePath: saved.path,
          altEn: (alt.altEn ?? "").trim().slice(0, MAX_ALT) || null,
          altAr: (alt.altAr ?? "").trim().slice(0, MAX_ALT) || null,
          sortOrder: next,
          isPrimary: existing.length === 0,
        },
      });
      // A photo added to a live listing is new content: back to review.
      const status = statusAfterPhotoAdded(l.status);
      if (status !== l.status) {
        await tx.listing.update({ where: { id: l.id }, data: { status } });
      }
      return row;
    });
    return {
      ok: true,
      image: { id: image.id, path: image.storagePath, altEn: image.altEn, altAr: image.altAr },
    };
  } catch (err) {
    // The row did not save: don't leave the file behind.
    await deleteStoredFile(saved.path);
    if (err instanceof Error && err.message === "PHOTO_LIMIT") return fail("photoLimit");
    return fail("photoFailed");
  }
}

/** Writes sortOrder 0..n-1 and marks the first as the cover. */
async function writeOrder(propertyId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.propertyImage.updateMany({
        where: { id, propertyId },
        data: { sortOrder: i, isPrimary: i === 0 },
      }),
    ),
  );
}

export type SimpleResult = { ok: true } | Failure;

/** Remove one photo. Removing never sends a live listing back to review. */
export async function removePhoto(
  actor: Actor,
  listingId: string,
  imageId: string,
): Promise<SimpleResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  const img = l.property.images.find((i) => i.id === imageId);
  if (!img) return fail("notFound");
  if (l.property.images.length === 1 && !mayRemoveLastPhoto(actor, l.status)) {
    return fail("lastPhoto");
  }
  await prisma.propertyImage.deleteMany({ where: { id: img.id, propertyId: l.propertyId } });
  await deleteStoredFile(img.storagePath);
  await writeOrder(
    l.propertyId,
    l.property.images.filter((i) => i.id !== img.id).map((i) => i.id),
  );
  return { ok: true };
}

/** Set the full photo order in one go. The first id becomes the cover. */
export async function setPhotoOrder(
  actor: Actor,
  listingId: string,
  orderedIds: string[],
): Promise<SimpleResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  const current = l.property.images.map((i) => i.id);
  if (!isSameIdSet(current, orderedIds)) return fail("wrongState");
  await writeOrder(l.propertyId, orderedIds);
  return { ok: true };
}

/** "Make cover", "Move earlier", "Move later" — one photo, one step. */
export async function movePhoto(
  actor: Actor,
  listingId: string,
  imageId: string,
  move: PhotoMove,
): Promise<SimpleResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  const next = reorderIds(l.property.images.map((i) => i.id), imageId, move);
  if (!next) return fail("notFound");
  await writeOrder(l.propertyId, next);
  return { ok: true };
}

/** Change a photo's description. It is public text, so on a live listing it goes back to review. */
export async function describePhoto(
  actor: Actor,
  listingId: string,
  imageId: string,
  alt: { altEn: string; altAr: string },
): Promise<SimpleResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  const img = l.property.images.find((i) => i.id === imageId);
  if (!img) return fail("notFound");
  const altEn = alt.altEn.trim().slice(0, MAX_ALT) || null;
  const altAr = alt.altAr.trim().slice(0, MAX_ALT) || null;
  if (altEn === img.altEn && altAr === img.altAr) return { ok: true };
  await prisma.propertyImage.updateMany({
    where: { id: img.id, propertyId: l.propertyId },
    data: { altEn, altAr },
  });
  const status = statusAfterPhotoAdded(l.status);
  if (status !== l.status) {
    await prisma.listing.update({ where: { id: l.id }, data: { status } });
  }
  return { ok: true };
}

// ---------- Status changes ----------

export type SendResult = { ok: true; status: "PENDING_REVIEW" } | Failure;

/**
 * Send a draft (or a rejected / withdrawn / sold / rented listing) for review.
 * Owners need a verified phone, a photo, both tick-boxes (first send) and a
 * free slot; agencies need room under their plan. The slot check runs inside
 * a transaction that first locks the owner's (or agency's) row, so two quick
 * clicks cannot both get through.
 */
export async function sendForReview(
  actor: Actor,
  listingId: string,
  opts: {
    confirmations?: { owner: boolean; phone: boolean };
    /** The free-launch switch (agencies only). */
    freeLaunch?: boolean;
  } = {},
): Promise<SendResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  if (!canSendForReview(l.status)) return fail("wrongState");

  if (!actor.agencyId) {
    if (!isPhoneVerified(await ownerRow(actor.userId))) return fail("phoneNotVerified");
    if (l.property.images.length < 1) return fail("photoRequired");
    if (l.status === "DRAFT" && !(opts.confirmations?.owner && opts.confirmations?.phone)) {
      return fail("confirmRequired");
    }
  }

  return prisma.$transaction(async (tx): Promise<SendResult> => {
    if (actor.agencyId) {
      await tx.$queryRaw`SELECT "id" FROM "Agency" WHERE "id" = ${actor.agencyId} FOR UPDATE`;
      const agency = await tx.agency.findUnique({
        where: { id: actor.agencyId },
        select: { tier: true },
      });
      if (!agency) return fail("notFound");
      const inPlay = await tx.listing.count({
        where: { agencyId: actor.agencyId, status: { in: IN_PLAY_STATUSES } },
      });
      if (!canAddListing(agency.tier, inPlay, { freeLaunch: opts.freeLaunch ?? false })) {
        return fail("capReached");
      }
    } else {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId} FOR UPDATE`;
      const inPlay = await tx.listing.count({
        where: { ...ownershipWhere(actor), status: { in: IN_PLAY_STATUSES } },
      });
      if (!ownerHasSlot(inPlay)) return fail("capReached");
    }
    // Same owner check again, inside the lock, so the status can't have moved.
    const moved = await tx.listing.updateMany({
      where: { id: l.id, ...ownershipWhere(actor), status: { in: ["DRAFT", "REJECTED", "ARCHIVED", "SOLD", "RENTED"] } },
      data: { status: "PENDING_REVIEW", reviewNote: null },
    });
    if (moved.count !== 1) return fail("wrongState");
    return { ok: true, status: "PENDING_REVIEW" };
  });
}

export type TakeDownResult = { ok: true; status: ListingStatus } | Failure;

/** Take a listing off the site: withdraw, sold or rented. Nothing is deleted. */
export async function takeDown(
  actor: Actor,
  listingId: string,
  reason: TakeDownReason,
): Promise<TakeDownResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  const next = takeDownStatus(l.status, l.listingType, reason);
  if (!next) return fail("wrongState");
  const moved = await prisma.listing.updateMany({
    where: { id: l.id, ...ownershipWhere(actor), status: l.status },
    data: { status: next },
  });
  if (moved.count !== 1) return fail("wrongState");
  return { ok: true, status: next };
}

/** Delete an unfinished draft and its photos. Nothing else can be deleted. */
export async function deleteDraft(actor: Actor, listingId: string): Promise<SimpleResult> {
  const l = await loadOwned(actor, listingId);
  if (!l) return fail("notFound");
  if (!canDeleteDraft(l.status)) return fail("wrongState");
  const paths = l.property.images.map((i) => i.storagePath);
  await prisma.$transaction(async (tx) => {
    const gone = await tx.listing.deleteMany({
      where: { id: l.id, ...ownershipWhere(actor), status: "DRAFT" },
    });
    if (gone.count !== 1) throw new Error("NOT_DRAFT");
    // The home goes too, unless something else still points at it.
    const left = await tx.listing.count({ where: { propertyId: l.propertyId } });
    if (left === 0) await tx.property.delete({ where: { id: l.propertyId } });
  }).catch((err) => {
    if (err instanceof Error && err.message === "NOT_DRAFT") return "wrongState" as const;
    throw err;
  });
  const still = await prisma.listing.findUnique({ where: { id: l.id }, select: { id: true } });
  if (still) return fail("wrongState");
  await Promise.all(paths.map(deleteStoredFile));
  return { ok: true };
}

// ---------- Reads for the screens ----------

/** The signed-in person's own listings, newest change first. */
export async function listingsForActor(actor: Actor) {
  return prisma.listing.findMany({
    where: ownershipWhere(actor),
    include: {
      property: {
        include: {
          neighborhood: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

/** How many of the actor's listings are live or in review (the slots used). */
export async function slotsUsed(actor: Actor): Promise<number> {
  return prisma.listing.count({
    where: { ...ownershipWhere(actor), status: { in: IN_PLAY_STATUSES } },
  });
}

/** One listing for its page — null when it is missing OR not the actor's (same answer). */
export async function listingForActor(actor: Actor, listingId: string) {
  if (!listingId || listingId.length > 64) return null;
  return prisma.listing.findFirst({
    where: { id: listingId, ...ownershipWhere(actor) },
    include: {
      property: {
        include: {
          neighborhood: { include: { city: true } },
          images: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

export type OwnedListingPage = NonNullable<Awaited<ReturnType<typeof listingForActor>>>;
export type { OwnedListing };

/** Prisma filter helper for callers that need to scope another query to the actor. */
export function scopedToActor(actor: Actor): Prisma.ListingWhereInput {
  return ownershipWhere(actor);
}
