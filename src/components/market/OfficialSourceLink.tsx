import { useTranslations } from "next-intl";
import type { DataProvenance } from "@prisma/client";

/**
 * Small "Source" link for an official figure. Shown only for OFFICIAL_STAT
 * rows whose sourceUrl is a real web address. The agency's private note is
 * never passed in or shown.
 */
export function OfficialSourceLink({
  provenance,
  sourceUrl,
}: {
  provenance: DataProvenance;
  sourceUrl?: string | null;
}) {
  const t = useTranslations("areaFigure");
  if (provenance !== "OFFICIAL_STAT" || !sourceUrl) return null;
  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-sky-700 underline underline-offset-2 hover:text-sky-900 rtl:text-sm dark:text-sky-400 dark:hover:text-sky-300"
    >
      {t("source")}
      <span aria-hidden="true" dir="ltr"> ↗</span>
    </a>
  );
}
