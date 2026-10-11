import { useTranslations } from "next-intl";
import type { ListingStatus } from "@prisma/client";

const styles: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  PENDING_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  PENDING_REVIEW_EDIT: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  SOLD: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  RENTED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  ARCHIVED: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
};

/**
 * The seller's own words for a listing's state (never the raw status code).
 * A listing back in review after it was published reads "Changes in review".
 * `withHint` adds the plain-words line underneath.
 */
export function OwnStatusPill({
  status,
  publishedBefore = false,
  withHint = false,
}: {
  status: ListingStatus;
  /** True when the listing has been published before (so PENDING means an edit). */
  publishedBefore?: boolean;
  withHint?: boolean;
}) {
  const t = useTranslations("myListing");
  const key = status === "PENDING_REVIEW" && publishedBefore ? "PENDING_REVIEW_EDIT" : status;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[key]}`}>
        {t(`status.${key}`)}
      </span>
      {withHint && <span className="text-xs text-stone-500 dark:text-stone-400">{t(`hint.${key}`)}</span>}
    </span>
  );
}
