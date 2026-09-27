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

export const PROVENANCE_VALUES = [
  "VERIFIED",
  "OFFICIAL_STAT",
  "USER_SUBMITTED",
  "AI_ESTIMATED",
] as const;

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
