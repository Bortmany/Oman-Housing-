"use server";

// Agency listing actions. Each one is thin: signed-in AGENCY check, an
// `agency:`-keyed rate limit (per agency, so all of its staff share it), then
// the shared core (src/lib/listings/core.ts), which checks OWNERSHIP inside its
// own query — another agency's listing and a missing one both read "notFound".

import { revalidatePath, updateTag } from "next/cache";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { checkRateLimit } from "@/lib/rate-limit";
import { getFreeLaunch } from "@/lib/siteSettings";
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
import { requireAgencyActor } from "@/lib/listings/agencyGuard";
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

/** Per-agency hourly limits. */
const LIMITS = {
  save: { key: "agency:listing:save", limit: 60 },
  photo: { key: "agency:listing:photo", limit: 200 },
  change: { key: "agency:listing:change", limit: 100 },
  photoEdit: { key: "agency:listing:photoedit", limit: 300 },
} as const;

function allowed(kind: keyof typeof LIMITS, agencyId: string): boolean {
  const { key, limit } = LIMITS[kind];
  return checkRateLimit(`${key}:${agencyId}`, { limit, windowMs: HOUR }).allowed;
}

/** Something a visitor can see may have changed: refresh the cached market pages. */
function refreshPublic() {
  updateTag(MARKET_DATA_CACHE_TAG);
  revalidatePath("/", "layout");
}

const asString = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function agencySaveListing(
  listingId: string | null,
  values: ListingValues,
): Promise<SaveActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("save", actor.agencyId!)) return RATE_LIMITED;
  const id = typeof listingId === "string" && listingId ? listingId.slice(0, 64) : null;
  const result = await saveListing(actor, { listingId: id, values: values ?? {} });
  if (result.ok) refreshPublic();
  return result;
}

export async function agencyUploadPhoto(formData: FormData): Promise<PhotoActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("photo", actor.agencyId!)) return RATE_LIMITED;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "photoType" };
  const result = await addPhoto(actor, asString(formData.get("listingId"), 64), file, {
    altEn: asString(formData.get("altEn"), 400),
    altAr: asString(formData.get("altAr"), 400),
  });
  if (result.ok) refreshPublic();
  return result;
}

export async function agencyRemovePhoto(
  listingId: string,
  imageId: string,
): Promise<SimpleActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("photoEdit", actor.agencyId!)) return RATE_LIMITED;
  const result = await removePhoto(actor, asString(listingId, 64), asString(imageId, 64));
  if (result.ok) refreshPublic();
  return result;
}

export async function agencySetPhotoOrder(
  listingId: string,
  orderedIds: string[],
): Promise<SimpleActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("photoEdit", actor.agencyId!)) return RATE_LIMITED;
  const ids = Array.isArray(orderedIds)
    ? orderedIds.filter((x): x is string => typeof x === "string").slice(0, 50)
    : [];
  const result = await setPhotoOrder(actor, asString(listingId, 64), ids);
  if (result.ok) refreshPublic();
  return result;
}

export async function agencyDescribePhoto(
  listingId: string,
  imageId: string,
  alt: { altEn: string; altAr: string },
): Promise<SimpleActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("photoEdit", actor.agencyId!)) return RATE_LIMITED;
  const result = await describePhoto(actor, asString(listingId, 64), asString(imageId, 64), {
    altEn: asString(alt?.altEn, 400),
    altAr: asString(alt?.altAr, 400),
  });
  if (result.ok) refreshPublic();
  return result;
}

/**
 * First send of a draft (the form's "Submit for review"). Agencies have no
 * tick-boxes; the form still passes them, and they are ignored.
 */
export async function agencySendForReview(
  listingId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _confirmations?: { owner: boolean; phone: boolean },
): Promise<SendActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("save", actor.agencyId!)) return RATE_LIMITED;
  const result = await sendForReview(actor, asString(listingId, 64), {
    freeLaunch: await getFreeLaunch(),
  });
  if (result.ok) refreshPublic();
  return result;
}

export async function agencyTakeDown(
  listingId: string,
  reason: TakeDownReason,
): Promise<TakeDownActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("change", actor.agencyId!)) return RATE_LIMITED;
  if (reason !== "SOLD" && reason !== "RENTED" && reason !== "WITHDRAW") {
    return { ok: false, error: "wrongState" };
  }
  const result = await takeDown(actor, asString(listingId, 64), reason);
  if (result.ok) refreshPublic();
  return result;
}

export async function agencyResubmit(listingId: string): Promise<SendActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("change", actor.agencyId!)) return RATE_LIMITED;
  const result = await sendForReview(actor, asString(listingId, 64), {
    freeLaunch: await getFreeLaunch(),
  });
  if (result.ok) refreshPublic();
  return result;
}

export async function agencyDeleteDraft(listingId: string): Promise<SimpleActionResult> {
  const actor = await requireAgencyActor();
  if (!actor) return NOT_FOUND;
  if (!allowed("change", actor.agencyId!)) return RATE_LIMITED;
  const result = await deleteDraft(actor, asString(listingId, 64));
  if (result.ok) refreshPublic();
  return result;
}
