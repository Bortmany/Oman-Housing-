"use server";

// Private-owner listing actions. Each one is thin: signed-in owner check,
// rate limit, then the shared core (src/lib/listings/core.ts), which checks
// OWNERSHIP inside its own query. Agencies get their own wrappers (Build B)
// over the same core.

import { revalidatePath, updateTag } from "next/cache";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  addPhoto,
  deleteDraft,
  describePhoto,
  removePhoto,
  saveListing,
  sendForReview,
  setPhotoOrder,
  takeDown,
} from "@/lib/listings/core";
import type { ListingValues, TakeDownReason } from "@/lib/listings/rules";
import { requireOwner } from "@/lib/listings/ownerGuard";
import type {
  ActionFailure,
  PhotoActionResult,
  SaveActionResult,
  SendActionResult,
  SimpleActionResult,
  TakeDownActionResult,
} from "@/components/listing-form/types";

const HOUR = 60 * 60 * 1000;

const NOT_FOUND: ActionFailure = { ok: false, error: "notFound" };
const RATE_LIMITED: ActionFailure = { ok: false, error: "rateLimited" };

/** Per-user hourly limits (spec section 7). */
const LIMITS = {
  save: { key: "listing:save:user", limit: 20 }, // save / submit
  photo: { key: "listing:photo:user", limit: 60 }, // files uploaded
  change: { key: "listing:change:user", limit: 30 }, // take off / resend / delete
  photoEdit: { key: "listing:photoedit:user", limit: 120 }, // remove / reorder / describe
} as const;

function allowed(kind: keyof typeof LIMITS, userId: string): boolean {
  const { key, limit } = LIMITS[kind];
  return checkRateLimit(`${key}:${userId}`, { limit, windowMs: HOUR }).allowed;
}

/** Something a visitor can see may have changed: refresh the cached market pages. */
function refreshPublic() {
  updateTag(MARKET_DATA_CACHE_TAG);
  revalidatePath("/", "layout");
}

const asString = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function ownerSaveListing(
  listingId: string | null,
  values: ListingValues,
): Promise<SaveActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("save", actor.userId)) return RATE_LIMITED;
  const id = typeof listingId === "string" && listingId ? listingId.slice(0, 64) : null;
  const result = await saveListing(actor, { listingId: id, values: values ?? {} });
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerUploadPhoto(formData: FormData): Promise<PhotoActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("photo", actor.userId)) return RATE_LIMITED;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "photoType" };
  const result = await addPhoto(actor, asString(formData.get("listingId"), 64), file, {
    altEn: asString(formData.get("altEn"), 400),
    altAr: asString(formData.get("altAr"), 400),
  });
  if (result.ok) refreshPublic(); // a photo on a live listing sends it back to review
  return result;
}

export async function ownerRemovePhoto(
  listingId: string,
  imageId: string,
): Promise<SimpleActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("photoEdit", actor.userId)) return RATE_LIMITED;
  const result = await removePhoto(actor, asString(listingId, 64), asString(imageId, 64));
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerSetPhotoOrder(
  listingId: string,
  orderedIds: string[],
): Promise<SimpleActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("photoEdit", actor.userId)) return RATE_LIMITED;
  const ids = Array.isArray(orderedIds)
    ? orderedIds.filter((x): x is string => typeof x === "string").slice(0, 50)
    : [];
  const result = await setPhotoOrder(actor, asString(listingId, 64), ids);
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerDescribePhoto(
  listingId: string,
  imageId: string,
  alt: { altEn: string; altAr: string },
): Promise<SimpleActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("photoEdit", actor.userId)) return RATE_LIMITED;
  const result = await describePhoto(actor, asString(listingId, 64), asString(imageId, 64), {
    altEn: asString(alt?.altEn, 400),
    altAr: asString(alt?.altAr, 400),
  });
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerSendForReview(
  listingId: string,
  confirmations: { owner: boolean; phone: boolean },
): Promise<SendActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("save", actor.userId)) return RATE_LIMITED;
  const result = await sendForReview(actor, asString(listingId, 64), {
    confirmations: {
      owner: confirmations?.owner === true,
      phone: confirmations?.phone === true,
    },
  });
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerTakeDown(
  listingId: string,
  reason: TakeDownReason,
): Promise<TakeDownActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("change", actor.userId)) return RATE_LIMITED;
  if (reason !== "SOLD" && reason !== "RENTED" && reason !== "WITHDRAW") {
    return { ok: false, error: "wrongState" };
  }
  const result = await takeDown(actor, asString(listingId, 64), reason);
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerResubmit(listingId: string): Promise<SendActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("change", actor.userId)) return RATE_LIMITED;
  const result = await sendForReview(actor, asString(listingId, 64));
  if (result.ok) refreshPublic();
  return result;
}

export async function ownerDeleteDraft(listingId: string): Promise<SimpleActionResult> {
  const actor = await requireOwner();
  if (!actor) return NOT_FOUND;
  if (!allowed("change", actor.userId)) return RATE_LIMITED;
  const result = await deleteDraft(actor, asString(listingId, 64));
  if (result.ok) refreshPublic();
  return result;
}
