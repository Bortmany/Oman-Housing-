import { useTranslations } from "next-intl";
import type { InquiryStatus } from "@prisma/client";

const styles: Record<InquiryStatus, string> = {
  NEW: "bg-teal-100 text-teal-800",
  CONTACTED: "bg-sky-100 text-sky-800",
  CLOSED: "bg-stone-100 text-stone-500",
  SPAM: "bg-rose-100 text-rose-800",
};

export function InquiryStatusPill({ status }: { status: InquiryStatus }) {
  const te = useTranslations("enums");
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {te(`inquiryStatus.${status}`)}
    </span>
  );
}
