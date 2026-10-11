// The owner flavour of the shared form's and panel's actions — plain bundles
// of the server actions in ./actions.ts, handed to the client components as
// props. (Agency pages pass their own bundles over the same core.)

import type { ListingFormActions, ListingPanelActions } from "@/components/listing-form/types";
import {
  ownerDeleteDraft,
  ownerDescribePhoto,
  ownerRemovePhoto,
  ownerResubmit,
  ownerSaveListing,
  ownerSendForReview,
  ownerSetPhotoOrder,
  ownerTakeDown,
  ownerUploadPhoto,
} from "./actions";

export const ownerFormActions: ListingFormActions = {
  save: ownerSaveListing,
  uploadPhoto: ownerUploadPhoto,
  removePhoto: ownerRemovePhoto,
  setPhotoOrder: ownerSetPhotoOrder,
  describePhoto: ownerDescribePhoto,
  sendForReview: ownerSendForReview,
};

export const ownerPanelActions: ListingPanelActions = {
  takeDown: ownerTakeDown,
  resubmit: ownerResubmit,
  deleteDraft: ownerDeleteDraft,
};
