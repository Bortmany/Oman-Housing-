import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/money";
import { propertyFinancials } from "@/lib/db/valuations";
import { activeListingsForProperty, nearestMarketStat } from "@/lib/db/listings";
import {
  finalizeVerdict,
  hasSufficientData,
  type FinalVerdict,
  type ModelVerdict,
  type OfferedDatum,
} from "./analystCore";

// The leashed Q&A analyst. Everything the model may talk about is gathered
// here from stored rows, tagged, and handed over; analystCore.ts enforces
// the honesty rules on whatever comes back.

export const ANALYST_MODEL = "claude-opus-5";
export const DAILY_QUESTION_LIMIT = 10;
const MAX_QUESTION_LENGTH = 300;

const DERIVED_CONFIDENCE_CAP = 0.5; // same cap as valuations.ts for derived figures

export type AnalystErrorCode =
  | "notConfigured"
  | "dailyLimit"
  | "badQuestion"
  | "apiError";

export type AnalystResult =
  | { ok: true; verdict: FinalVerdict; analysisId: string }
  | { ok: false; code: AnalystErrorCode };

// ---------- Gathering the citable evidence ----------

type PropertyForAnalysis = NonNullable<Awaited<ReturnType<typeof loadProperty>>>;

async function loadProperty(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    include: { neighborhood: { include: { city: true } } },
  });
}

function monthLabel(date: Date): string {
  return date.toISOString().slice(0, 7); // "2026-05"
}

export async function gatherOfferedData(
  property: PropertyForAnalysis,
): Promise<OfferedDatum[]> {
  const [financials, comp, ownListings, valuation, history, comparables] =
    await Promise.all([
      propertyFinancials(property.id),
      nearestMarketStat(property.neighborhoodId, property.type),
      activeListingsForProperty(property.id),
      prisma.valuationEstimate.findFirst({
        where: { propertyId: property.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.marketStat.findMany({
        where: {
          neighborhoodId: property.neighborhoodId,
          propertyType: property.type,
        },
        orderBy: { periodStart: "desc" },
        take: 13,
      }),
      prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          propertyId: { not: property.id },
          property: {
            neighborhoodId: property.neighborhoodId,
            type: property.type,
          },
        },
        include: { property: { select: { bedrooms: true, areaSqm: true } } },
        orderBy: { publishedAt: "desc" },
        take: 4,
      }),
    ]);

  const offered: OfferedDatum[] = [];
  const hood = property.neighborhood.nameEn;

  // Latest market statistics for the nearest scope (neighborhood → city → national)
  if (comp) {
    const period = monthLabel(comp.periodStart);
    const statFields: Array<{
      tag: string;
      labelKey: string;
      format: OfferedDatum["format"];
      value: number | null;
      unit: string;
    }> = [
      { tag: "STAT-PRICE", labelKey: "avgSalePrice", format: "money",
        value: decimalToNumber(comp.avgSalePrice), unit: "OMR" },
      { tag: "STAT-SQM", labelKey: "avgPricePerSqm", format: "money",
        value: decimalToNumber(comp.avgPricePerSqm), unit: "OMR per sqm" },
      { tag: "STAT-RENT", labelKey: "avgRentMonthly", format: "money",
        value: decimalToNumber(comp.avgRentMonthly), unit: "OMR per month" },
      { tag: "STAT-YIELD", labelKey: "avgYield", format: "percent",
        value: decimalToNumber(comp.grossYieldPct), unit: "% gross yield" },
    ];
    for (const f of statFields) {
      if (f.value == null) continue;
      offered.push({
        tag: f.tag,
        sourceType: "MARKET_STAT",
        sourceId: comp.id,
        labelKey: f.labelKey,
        labelParams: { scope: hood, period },
        format: f.format,
        value: f.value,
        promptText: `${f.labelKey} for comparable ${property.type} in this market area, ${period}: ${f.value} ${f.unit}`,
        provenance: comp.provenance,
        confidence: comp.confidence,
        snapshot: { field: f.labelKey, value: f.value, period, scope: hood },
      });
    }
  }

  // 12-month price trend, derived from the neighborhood's stat history
  const priced = history.filter((s) => s.avgSalePrice != null);
  if (priced.length >= 2) {
    const latest = priced[0];
    const oldest = priced[priced.length - 1];
    const from = decimalToNumber(oldest.avgSalePrice)!;
    const to = decimalToNumber(latest.avgSalePrice)!;
    if (from > 0) {
      const changePct = Math.round(((to - from) / from) * 1000) / 10;
      offered.push({
        tag: "TREND-PRICE",
        sourceType: "MARKET_STAT",
        sourceId: latest.id,
        labelKey: "priceTrend",
        labelParams: {
          scope: hood,
          from: monthLabel(oldest.periodStart),
          to: monthLabel(latest.periodStart),
        },
        format: "percent",
        value: changePct,
        promptText: `Average sale price change in this neighborhood from ${monthLabel(oldest.periodStart)} to ${monthLabel(latest.periodStart)}: ${changePct}% (derived from stored monthly statistics)`,
        provenance: "AI_ESTIMATED",
        confidence: Math.min(latest.confidence, DERIVED_CONFIDENCE_CAP),
        snapshot: {
          field: "priceTrend",
          fromPeriod: monthLabel(oldest.periodStart),
          toPeriod: monthLabel(latest.periodStart),
          fromValue: from,
          toValue: to,
          changePct,
        },
      });
    }
  }

  // A stored valuation for this exact property, if one exists
  if (valuation) {
    const mid = decimalToNumber(valuation.valueMid)!;
    offered.push({
      tag: "VAL-MID",
      sourceType: "VALUATION",
      sourceId: valuation.id,
      labelKey: "storedValuation",
      format: "money",
      value: mid,
      promptText: `Stored valuation for this property (${valuation.method}): OMR ${mid} (range ${decimalToNumber(valuation.valueLow)}–${decimalToNumber(valuation.valueHigh)})`,
      provenance: valuation.provenance,
      confidence: valuation.confidence,
      snapshot: {
        field: "valuationMid",
        value: mid,
        low: decimalToNumber(valuation.valueLow),
        high: decimalToNumber(valuation.valueHigh),
        method: valuation.method,
      },
    });
  }

  // This property's own active listings — the real asking prices
  for (const listing of ownListings.slice(0, 2)) {
    const price = decimalToNumber(listing.price)!;
    const isRent = listing.listingType === "RENT";
    offered.push({
      tag: isRent ? "LST-RENT" : "LST-SALE",
      sourceType: "LISTING",
      sourceId: listing.id,
      labelKey: isRent ? "askingRent" : "askingPrice",
      format: "money",
      value: price,
      promptText: `This property's live ${isRent ? `rent listing: OMR ${price} per ${listing.rentPeriod === "ANNUAL" ? "year" : "month"}` : `sale listing: OMR ${price}`}`,
      provenance: listing.provenance,
      confidence: listing.confidence,
      snapshot: {
        field: isRent ? "askingRent" : "askingPrice",
        value: price,
        rentPeriod: listing.rentPeriod,
      },
    });
  }

  // Derived financials for this property (computed by valuations.ts — reused, not recomputed)
  if (financials.grossYieldPct) {
    offered.push({
      tag: "FIN-YIELD",
      sourceType: "PROPERTY",
      sourceId: property.id,
      labelKey: "estimatedYield",
      format: "percent",
      value: financials.grossYieldPct.value,
      promptText: `Estimated gross rental yield for this property: ${financials.grossYieldPct.value.toFixed(1)}% (derived estimate)`,
      provenance: financials.grossYieldPct.provenance,
      confidence: financials.grossYieldPct.confidence,
      snapshot: { field: "grossYieldPct", value: financials.grossYieldPct.value },
    });
  }
  if (financials.investment.score != null) {
    offered.push({
      tag: "FIN-SCORE",
      sourceType: "PROPERTY",
      sourceId: property.id,
      labelKey: "investmentScore",
      format: "score",
      value: financials.investment.score,
      promptText: `Platform investment score for this property: ${financials.investment.score}/100 (${financials.investment.band}) — a transparent heuristic, always AI-estimated`,
      provenance: "AI_ESTIMATED",
      confidence: financials.investmentConfidence ?? 0,
      snapshot: {
        field: "investmentScore",
        value: financials.investment.score,
        band: financials.investment.band,
      },
    });
  }

  // Comparable active listings nearby (same neighborhood and type)
  comparables.forEach((c, i) => {
    const price = decimalToNumber(c.price)!;
    offered.push({
      tag: `COMP-${i + 1}`,
      sourceType: "LISTING",
      sourceId: c.id,
      labelKey: "comparableListing",
      labelParams: { n: String(i + 1) },
      format: "money",
      value: price,
      promptText: `Comparable active ${c.listingType} listing in the same neighborhood: OMR ${price}${c.property.bedrooms ? `, ${c.property.bedrooms} bed` : ""}${c.property.areaSqm ? `, ${decimalToNumber(c.property.areaSqm)} sqm` : ""}`,
      provenance: c.provenance,
      confidence: c.confidence,
      snapshot: {
        field: "comparablePrice",
        value: price,
        listingType: c.listingType,
        bedrooms: c.property.bedrooms,
        areaSqm: decimalToNumber(c.property.areaSqm),
      },
    });
  });

  return offered;
}

// ---------- The model call ----------

const verdictSchema = z.object({
  rating: z.enum(["BUY", "CONSIDER", "AVOID", "INSUFFICIENT_DATA"]),
  confidence: z.number(),
  answer: z.string().min(1),
  citedTags: z.array(z.string()),
});

const VERDICT_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    rating: {
      type: "string",
      enum: ["BUY", "CONSIDER", "AVOID", "INSUFFICIENT_DATA"],
      description: "The verdict on the user's question.",
    },
    confidence: {
      type: "number",
      description:
        "How well the stored data supports the verdict, 0 to 1. Thin or old data means low confidence.",
    },
    answer: {
      type: "string",
      description:
        "The explanation for the user, in the requested language. Under 180 words, plain language.",
    },
    citedTags: {
      type: "array",
      items: { type: "string" },
      description: "Tags of every data point the answer relies on.",
    },
  },
  required: ["rating", "confidence", "answer", "citedTags"],
  additionalProperties: false,
};

function buildSystemPrompt(locale: string): string {
  const language = locale === "ar" ? "Arabic" : "English";
  return [
    "You are the AI analyst of the Oman Property Intelligence Platform, a real-estate analytics site for Oman. A user is asking about one specific property.",
    "",
    "Hard rules — the platform's whole reputation rests on these:",
    "- Base every claim ONLY on the tagged data points provided in the user message. Never use outside knowledge of prices, areas, or market conditions, and never invent a number.",
    "- List in citedTags the tag of every data point your answer relies on.",
    "- If the data is too thin, too old, or contradictory to justify a verdict, return rating INSUFFICIENT_DATA and say plainly what is missing. An honest 'not enough data' is a good answer on this platform.",
    "- Set confidence to how well the data supports the verdict (0 to 1). Data labeled AI_ESTIMATED or with low confidence values must pull your confidence down.",
    "- Prices are in Omani Rial (OMR). Quote figures exactly as given.",
    `- Write the answer in ${language}, in plain language for a non-expert, under 180 words. Use Latin digits for numbers.`,
    "- You are giving an analysis of stored data, not financial advice; do not promise future returns.",
  ].join("\n");
}

function buildUserPrompt(
  property: PropertyForAnalysis,
  question: string,
  offered: OfferedDatum[],
): string {
  const facts = [
    `Type: ${property.type}`,
    `Neighborhood: ${property.neighborhood.nameEn}, ${property.neighborhood.city.nameEn}`,
    property.bedrooms != null ? `Bedrooms: ${property.bedrooms}` : null,
    property.areaSqm != null ? `Area: ${decimalToNumber(property.areaSqm)} sqm` : null,
    property.yearBuilt != null ? `Year built: ${property.yearBuilt}` : null,
    `Ownership eligibility: ${property.ownership}`,
    property.neighborhood.isITC ? "Located in an ITC (foreigners may buy)" : null,
  ].filter(Boolean);

  const data = offered.map(
    (d) =>
      `[${d.tag}] ${d.promptText} — source: ${d.provenance}, confidence ${Math.round(d.confidence * 100)}%`,
  );

  return [
    `PROPERTY: ${property.titleEn}`,
    ...facts,
    "",
    "STORED DATA POINTS (the only evidence you may use):",
    ...data,
    "",
    `USER QUESTION: ${question}`,
  ].join("\n");
}

async function callClaude(
  property: PropertyForAnalysis,
  question: string,
  locale: string,
  offered: OfferedDatum[],
): Promise<ModelVerdict | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: ANALYST_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(locale),
    output_config: {
      format: { type: "json_schema", schema: VERDICT_JSON_SCHEMA },
    },
    messages: [
      { role: "user", content: buildUserPrompt(property, question, offered) },
    ],
  });

  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return null;
  const parsed = verdictSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

// ---------- Orchestration ----------

async function underDailyLimit(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const used = await prisma.aiAnalysis.count({
    where: { userId, createdAt: { gte: since } },
  });
  return used < DAILY_QUESTION_LIMIT;
}

async function persist(
  userId: string,
  propertyId: string,
  neighborhoodId: string,
  question: string,
  verdict: FinalVerdict,
): Promise<string> {
  const analysis = await prisma.aiAnalysis.create({
    data: {
      userId,
      question,
      answer: verdict.answer,
      rating: verdict.rating,
      confidence: verdict.confidence,
      propertyId,
      neighborhoodId,
      model: ANALYST_MODEL,
      citations: {
        create: verdict.citations.map((c) => ({
          sourceType: c.sourceType,
          sourceId: c.sourceId,
          snapshot: {
            ...c.snapshot,
            provenance: c.provenance,
            confidence: c.confidence,
            labelKey: c.labelKey,
            labelParams: c.labelParams ?? {},
          },
        })),
      },
    },
  });
  return analysis.id;
}

/**
 * Answer one user question about one property. Order of defenses:
 * question sanity → daily cost cap → data sufficiency (no API call when the
 * data can't support an answer) → model call → honesty rules → persist.
 */
export async function runAnalyst(input: {
  userId: string;
  propertyId: string;
  question: string;
  locale: string;
  /** Localized text stored/shown when the data is too thin to call the model. */
  insufficientAnswer: string;
}): Promise<AnalystResult> {
  const question = input.question.trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return { ok: false, code: "badQuestion" };
  }

  const property = await loadProperty(input.propertyId);
  if (!property) return { ok: false, code: "badQuestion" };

  if (!(await underDailyLimit(input.userId))) {
    return { ok: false, code: "dailyLimit" };
  }

  const offered = await gatherOfferedData(property);

  if (!hasSufficientData(offered)) {
    const verdict: FinalVerdict = {
      rating: "INSUFFICIENT_DATA",
      confidence: 0,
      answer: input.insufficientAnswer,
      citations: [],
    };
    const analysisId = await persist(
      input.userId, property.id, property.neighborhoodId, question, verdict,
    );
    return { ok: true, verdict, analysisId };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, code: "notConfigured" };
  }

  let raw: ModelVerdict | null;
  try {
    raw = await callClaude(property, question, input.locale, offered);
  } catch (err) {
    console.error("AI analyst call failed:", err);
    return { ok: false, code: "apiError" };
  }
  if (!raw) return { ok: false, code: "apiError" };

  const verdict = finalizeVerdict(raw, offered);
  const analysisId = await persist(
    input.userId, property.id, property.neighborhoodId, question, verdict,
  );
  return { ok: true, verdict, analysisId };
}
