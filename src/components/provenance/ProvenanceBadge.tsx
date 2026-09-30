import { useTranslations } from "next-intl";
import type { DataProvenance } from "@prisma/client";
import {
  provenanceStyles,
  formatConfidence,
  SAMPLE_STYLE,
} from "@/lib/provenance";
import { Tooltip } from "@/components/ui/Tooltip";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset rtl:text-sm";

type ProvenanceBadgeProps =
  | {
      provenance: DataProvenance;
      confidence?: number;
      /** true = invented demonstration data: draws the Sample badge and ignores confidence. */
      isSample?: boolean;
    }
  | { provenance?: undefined; confidence?: undefined; isSample: true };

// The data-honesty badge: which kind of source a figure came from, and how
// confident we are in it. Shown next to every market figure in the app.
// Sample data gets its own grey dashed badge with NO percentage — a
// percentage on invented data would suggest it was measured.
export function ProvenanceBadge({
  provenance,
  confidence,
  isSample,
}: ProvenanceBadgeProps) {
  const t = useTranslations("provenance");

  if (isSample || provenance == null) {
    return (
      <Tooltip label={t("sampleHint")}>
        {/* Focusable so a tap on a phone reveals the hint (Tooltip shows on focus-within). */}
        <span tabIndex={0} className={`${BASE} whitespace-nowrap ${SAMPLE_STYLE}`}>
          {t("sample")}
        </span>
      </Tooltip>
    );
  }

  const hint =
    confidence != null
      ? `${t("badgeHint")} ${t("confidence")}: ${formatConfidence(confidence)}`
      : t("badgeHint");
  return (
    <Tooltip label={hint}>
      <span className={`${BASE} ${provenanceStyles[provenance]}`}>
        {t(provenance)}
        {confidence != null && (
          <span className="opacity-70">{formatConfidence(confidence)}</span>
        )}
      </span>
    </Tooltip>
  );
}
