// The agency flavour of the shared form's and panel's actions — plain bundles
// of the server actions in ./actions.ts, handed to the client components as
// props (the same shape the owner pages use).

import type { ListingFormActions, ListingPanelActions } from "@/components/listing-form/types";
import {
  agencyDeleteDraft,
  agencyDescribePhoto,
  agencyRemovePhoto,
  agencyResubmit,
  agencySaveListing,
  agencySendForReview,
  agencySetPhotoOrder,
  agencyTakeDown,
  agencyUploadPhoto,
} from "./actions";

export const agencyFormActions: ListingFormActions = {
  save: agencySaveListing,
  uploadPhoto: agencyUploadPhoto,
  removePhoto: agencyRemovePhoto,
  setPhotoOrder: agencySetPhotoOrder,
  describePhoto: agencyDescribePhoto,
  sendForReview: agencySendForReview,
};

export const agencyPanelActions: ListingPanelActions = {
  takeDown: agencyTakeDown,
  resubmit: agencyResubmit,
  deleteDraft: agencyDeleteDraft,
};
