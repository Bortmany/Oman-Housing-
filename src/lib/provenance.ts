import type { DataProvenance } from "@prisma/client";

// One visual language for data honesty across the whole app.
export const provenanceStyles: Record<DataProvenance, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  OFFICIAL_STAT: "bg-sky-100 text-sky-800 ring-sky-600/20",
  USER_SUBMITTED: "bg-amber-100 text-amber-800 ring-amber-600/20",
  AI_ESTIMATED: "bg-violet-100 text-violet-800 ring-violet-600/20",
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
