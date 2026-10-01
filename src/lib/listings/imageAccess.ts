import { isPropertyPublic } from "./rules";

// Who may see a stored photo. Pure (no database), tested in imageAccess.test.ts.
//   "public"  - anyone; cached by browsers and CDNs
//   "private" - only this signed-in viewer; never cached by shared caches
//   "deny"    - answer 404 (we don't confirm the photo exists)

export type ImageViewer = {
  userId: string;
  role: string | null | undefined;
  agencyId: string | null | undefined;
} | null;

export type ImageListing = {
  status: Parameters<typeof isPropertyPublic>[0][number];
  createdById: string;
  agencyId: string | null;
};

export type ImageAccess = "public" | "private" | "deny";

/**
 * `listings` is null when the photo is not linked to any property (for example
 * a file nobody has attached yet): that keeps today's behaviour (public).
 */
export function decideImageAccess(
  listings: ImageListing[] | null,
  viewer: ImageViewer,
): ImageAccess {
  if (listings === null) return "public";
  if (isPropertyPublic(listings.map((l) => l.status))) return "public";
  if (!viewer) return "deny";
  if (viewer.role === "ADMIN") return "private";
  const mine = listings.some(
    (l) =>
      l.createdById === viewer.userId ||
      (viewer.agencyId != null && l.agencyId === viewer.agencyId),
  );
  return mine ? "private" : "deny";
}
