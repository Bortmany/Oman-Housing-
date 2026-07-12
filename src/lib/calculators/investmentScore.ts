// Pure function — no UI, no I/O. The score is a transparent heuristic and is
// ALWAYS displayed with an AI_ESTIMATED provenance badge. Weights:
// 60% gross yield (8%/yr treated as a strong benchmark for Oman),
// 25% data confidence, 15% recency of the underlying comp data.

export type InvestmentScoreInput = {
  grossYieldPct: number | null;
  confidence: number; // 0..1
  dataAgeMonths: number | null; // null = fresh (e.g. stored valuation)
};

export type InvestmentBand = "STRONG" | "MODERATE" | "WEAK" | "INSUFFICIENT_DATA";

export type InvestmentScoreResult = {
  score: number | null; // 0..100
  band: InvestmentBand;
};

const YIELD_BENCHMARK_PCT = 8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

export function investmentScore(
  input: InvestmentScoreInput,
): InvestmentScoreResult {
  if (input.grossYieldPct == null) {
    return { score: null, band: "INSUFFICIENT_DATA" };
  }
  const yieldScore = clamp((input.grossYieldPct / YIELD_BENCHMARK_PCT) * 100, 0, 100);
  const confidenceScore = clamp(input.confidence, 0, 1) * 100;
  const recencyScore =
    input.dataAgeMonths == null ? 100 : clamp(100 - input.dataAgeMonths * 4, 0, 100);

  const score = Math.round(
    yieldScore * 0.6 + confidenceScore * 0.25 + recencyScore * 0.15,
  );
  const band: InvestmentBand =
    score >= 70 ? "STRONG" : score >= 45 ? "MODERATE" : "WEAK";
  return { score, band };
}
