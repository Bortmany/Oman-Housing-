import { useTranslations } from "next-intl";
import { anySample } from "@/lib/db/sampleData";
import { ProvenanceBadge } from "./ProvenanceBadge";

// The honesty line under a trend chart (house rule 1): when any plotted row
// is sample data, the chart card says so — "sample only" when every row is
// sample, "includes sample months" when real and sample rows are mixed.
// Shows nothing when every row is real.
export function ChartSampleNote({
  rows,
}: {
  /** Every row the chart plots (the same rows the chart data is built from). */
  rows: Array<{ isSample: boolean }>;
}) {
  const t = useTranslations("provenance");
  if (!anySample(rows)) return null;
  const allSample = rows.every((r) => r.isSample);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ProvenanceBadge isSample />
      <p className="text-start text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
        {allSample ? t("chartSampleOnly") : t("chartIncludesSample")}
      </p>
    </div>
  );
}
