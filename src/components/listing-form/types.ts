// The shapes the shared listing form and its action panel talk in. They are
// plain data (no Prisma types) so they cross from server pages to the client
// form safely. The form receives its ACTIONS AS PROPS: the owner routes pass
// owner-flavoured server actions, the agency routes (Build B) pass their own —
// both thin wrappers over src/lib/listings/core.ts.

import type {
  CoreError,
} from "@/lib/listings/core";
import type { FieldErrors, ListingValues, TakeDownReason } from "@/lib/listings/rules";

export type ActionError = CoreError | "rateLimited";

export type ActionFailure = {
  ok: false;
  error: ActionError;
  fieldErrors?: FieldErrors;
  values?: ListingValues;
  count?: number;
};

export type SavedPhoto = {
  id: string;
  path: string;
  altEn: string | null;
  altAr: string | null;
};

export type SaveActionResult =
  | { ok: true; listingId: string; status: string; changed: boolean }
  | ActionFailure;
export type PhotoActionResult = { ok: true; image: SavedPhoto } | ActionFailure;
export type SimpleActionResult = { ok: true } | ActionFailure;
export type SendActionResult = { ok: true; status: "PENDING_REVIEW" } | ActionFailure;
export type TakeDownActionResult = { ok: true; status: string } | ActionFailure;

export type ListingFormActions = {
  save: (listingId: string | null, values: ListingValues) => Promise<SaveActionResult>;
  /** FormData: listingId, file, altEn, altAr — one photo per request. */
  uploadPhoto: (formData: FormData) => Promise<PhotoActionResult>;
  removePhoto: (listingId: string, imageId: string) => Promise<SimpleActionResult>;
  setPhotoOrder: (listingId: string, orderedIds: string[]) => Promise<SimpleActionResult>;
  describePhoto: (
    listingId: string,
    imageId: string,
    alt: { altEn: string; altAr: string },
  ) => Promise<SimpleActionResult>;
  /** Owners pass their two tick-boxes; agencies pass nothing. */
  sendForReview: (
    listingId: string,
    confirmations: { owner: boolean; phone: boolean },
  ) => Promise<SendActionResult>;
};

export type ListingPanelActions = {
  takeDown: (listingId: string, reason: TakeDownReason) => Promise<TakeDownActionResult>;
  resubmit: (listingId: string) => Promise<SendActionResult>;
  deleteDraft: (listingId: string) => Promise<SimpleActionResult>;
};

export type NeighborhoodOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  city: { nameEn: string; nameAr: string };
};
