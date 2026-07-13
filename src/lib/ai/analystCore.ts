import type { AiRating, CitedSourceType, DataProvenance } from "@prisma/client";

// Pure functions — no I/O. These enforce the honesty rules on every AI answer
// AFTER the model responds, so the guarantees hold no matter what the model
// says. Tested in analystCore.test.ts alongside the calculator tests.

/** One stored figure offered to the model as citable evidence. */
export type OfferedDatum = {
  tag: string; // short handle the model cites, e.g. "STAT-PRICE", "FIN-YIELD"
  sourceType: CitedSourceType;
  sourceId: string; // DB row id (propertyId for FIN figures)
  labelKey: string; // messages key under analyst.data.* (UI strings live there)
  labelParams?: Record<string, string>;
  format: "money" | "percent" | "score" | "text";
  value: number | string;
  promptText: string; // English one-liner given to the model (not shown in UI)
  provenance: DataProvenance;
  confidence: number; // 0..1
  snapshot: Record<string, unknown>; // frozen values stored in AiCitation
};

/** What the model must return (validated with zod at the call site). */
export type ModelVerdict = {
  rating: AiRating;
  confidence: number;
  answer: string;
  citedTags: string[];
};

/** The verdict after the honesty rules have been applied. */
export type FinalVerdict = {
  rating: AiRating;
  confidence: number;
  answer: string;
  citations: OfferedDatum[];
};

// An AI answer may never claim near-certainty — same spirit as the
// DERIVED_CONFIDENCE_CAP in valuations.ts, slightly higher because the
// answer can rest on several figures at once.
export const AI_ANSWER_CONFIDENCE_CAP = 0.75;

/**
 * Deterministic pre-flight gate: is there enough stored data to justify a
 * rating at all? If not, the model is never called. Requires at least two
 * citable figures, at least one of which is market-level evidence
 * (a market statistic or a stored valuation) with non-zero confidence.
 */
export function hasSufficientData(offered: OfferedDatum[]): boolean {
  const usable = offered.filter((d) => d.confidence > 0);
  if (usable.length < 2) return false;
  return usable.some(
    (d) => d.sourceType === "MARKET_STAT" || d.sourceType === "VALUATION",
  );
}

/** Keep only citations that match figures we actually offered. */
export function validateCitations(
  citedTags: string[],
  offered: OfferedDatum[],
): OfferedDatum[] {
  const byTag = new Map(offered.map((d) => [d.tag, d]));
  const seen = new Set<string>();
  const valid: OfferedDatum[] = [];
  for (const tag of citedTags) {
    const datum = byTag.get(tag);
    if (datum && !seen.has(tag)) {
      seen.add(tag);
      valid.push(datum);
    }
  }
  return valid;
}

/**
 * The answer can never be more confident than the weakest figure it stands
 * on, and never above the AI cap. No citations → zero confidence.
 */
export function capConfidence(
  modelConfidence: number,
  citations: OfferedDatum[],
): number {
  if (citations.length === 0) return 0;
  const weakest = Math.min(...citations.map((c) => c.confidence));
  const clamped = Math.min(Math.max(modelConfidence, 0), 1);
  return Math.round(Math.min(clamped, weakest, AI_ANSWER_CONFIDENCE_CAP) * 100) / 100;
}

/**
 * Apply every honesty rule to the raw model output:
 * - citations are filtered to figures we actually offered;
 * - a Buy/Consider/Avoid rating with no surviving citations is downgraded
 *   to INSUFFICIENT_DATA (an unsupported verdict is not a verdict);
 * - confidence is capped by the weakest cited figure and the AI cap.
 */
export function finalizeVerdict(
  raw: ModelVerdict,
  offered: OfferedDatum[],
): FinalVerdict {
  const citations = validateCitations(raw.citedTags, offered);
  const unsupported = raw.rating !== "INSUFFICIENT_DATA" && citations.length === 0;
  const rating: AiRating = unsupported ? "INSUFFICIENT_DATA" : raw.rating;
  const confidence =
    rating === "INSUFFICIENT_DATA" ? 0 : capConfidence(raw.confidence, citations);
  return { rating, confidence, answer: raw.answer, citations };
}
