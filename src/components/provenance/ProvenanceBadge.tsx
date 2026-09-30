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
      /** Listings behind a LISTING_DERIVED average: the badge then reads "From live listings · n". */
      sampleSize?: number | null;
      focusable?: boolean;
    }
  | {
      provenance?: undefined;
      confidence?: undefined;
      isSample: true;
      sampleSize?: undefined;
      /**
       * false when the badge sits inside a link or button: the link itself is
       * already the tab stop, and a second one inside it would be confusing.
       */
      focusable?: boolean;
    };

// The data-honesty badge: which kind of source a figure came from, and how
// confident we are in it. Shown next to every market figure in the app.
// Sample data gets its own grey dashed badge with NO percentage — a
// percentage on invented data would suggest it was measured.
export function ProvenanceBadge({
  provenance,
  confidence,
  isSample,
  sampleSize,
  focusable = true,
}: ProvenanceBadgeProps) {
  const t = useTranslations("provenance");

  if (isSample || provenance == null) {
    return (
      <Tooltip label={t("sampleHint")}>
        {/* Focusable so a tap on a phone reveals the hint (Tooltip shows on focus-within),
            except inside a link, where the link itself is the tab stop. */}
        <span tabIndex={focusable ? 0 : undefined} className={`${BASE} whitespace-nowrap ${SAMPLE_STYLE}`}>
          {t("sample")}
        </span>
      </Tooltip>
    );
  }

  const derived = provenance === "LISTING_DERIVED";
  const baseHint = derived ? t("listingHint") : t("badgeHint");
  const hint =
    confidence != null
      ? `${baseHint} ${t("confidence")}: ${formatConfidence(confidence)}`
      : baseHint;
  // "From live listings · 7" — the count is shown only for derived averages.
  const count = derived && sampleSize != null && sampleSize > 0 ? sampleSize : null;
  return (
    <Tooltip label={hint}>
      <span className={`${BASE} ${provenanceStyles[provenance]}`}>
        {t(provenance)}
        {count != null && (
          <span className="tabular-nums">
            <span aria-hidden="true">·</span> {count}
            <span className="sr-only"> {t("listingCount", { count })}</span>
          </span>
        )}
        {confidence != null && (
          <span className="opacity-70">{formatConfidence(confidence)}</span>
        )}
      </span>
    </Tooltip>
  );
}
