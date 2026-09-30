import type { DataProvenance } from "@prisma/client";

// One visual language for data honesty across the whole app.
export const provenanceStyles: Record<DataProvenance, string> = {
  VERIFIED:
    "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-400/30",
  OFFICIAL_STAT:
    "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-400/30",
  USER_SUBMITTED:
    "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-400/30",
  AI_ESTIMATED:
    "bg-violet-100 text-violet-800 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-400/30",
};

// Sample (invented demonstration) data: plain grey with a dashed outline so it
// reads as a placeholder, never as a measurement. Not a fifth provenance value
// — sample-ness is the separate `isSample` flag on each row.
export const SAMPLE_STYLE =
  "bg-stone-100 text-stone-700 ring-stone-500/30 border border-dashed border-stone-400 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-400/30 dark:border-stone-500";

export const PROVENANCE_VALUES = [
  "VERIFIED",
  "OFFICIAL_STAT",
  "USER_SUBMITTED",
  "AI_ESTIMATED",
] as const;

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
