import { useTranslations } from "next-intl";
import type { DataProvenance } from "@prisma/client";
import { provenanceStyles, formatConfidence } from "@/lib/provenance";

// The data-honesty badge: which kind of source a figure came from, and how
// confident we are in it. Shown next to every market figure in the app.
export function ProvenanceBadge({
  provenance,
  confidence,
}: {
  provenance: DataProvenance;
  confidence?: number;
}) {
  const t = useTranslations("provenance");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset rtl:text-sm ${provenanceStyles[provenance]}`}
      title={
        confidence != null
          ? `${t("confidence")}: ${formatConfidence(confidence)}`
          : undefined
      }
    >
      {t(provenance)}
      {confidence != null && (
        <span className="opacity-70">{formatConfidence(confidence)}</span>
      )}
    </span>
  );
}
