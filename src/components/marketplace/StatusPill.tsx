import { useTranslations } from "next-intl";
import type { ListingStatus } from "@prisma/client";

const styles: Record<ListingStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  SOLD: "bg-sky-100 text-sky-800",
  RENTED: "bg-sky-100 text-sky-800",
  ARCHIVED: "bg-stone-100 text-stone-500",
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
