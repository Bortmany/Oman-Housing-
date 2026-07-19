import { useTranslations } from "next-intl";
import type { DataProvenance } from "@prisma/client";
import { provenanceStyles, formatConfidence } from "@/lib/provenance";
import { Tooltip } from "@/components/ui/Tooltip";

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
  const hint =
    confidence != null
      ? `${t("badgeHint")} ${t("confidence")}: ${formatConfidence(confidence)}`
      : t("badgeHint");
  return (
    <Tooltip label={hint}>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${provenanceStyles[provenance]}`}
      >
        {t(provenance)}
        {confidence != null && (
          <span className="opacity-70">{formatConfidence(confidence)}</span>
        )}
      </span>
    </Tooltip>
  );
}
