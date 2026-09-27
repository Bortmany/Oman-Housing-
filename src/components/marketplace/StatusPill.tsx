import { useTranslations } from "next-intl";
import type { ListingStatus } from "@prisma/client";

const styles: Record<ListingStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  PENDING_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  SOLD: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  RENTED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  ARCHIVED: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

export function StatusPill({ status }: { status: ListingStatus }) {
  const te = useTranslations("enums");
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {te(`listingStatus.${status}`)}
    </span>
  );
}
