// Honesty-rule tests for the AI analyst.
import { describe, expect, test } from "vitest";
import {
  AI_ANSWER_CONFIDENCE_CAP,
  capConfidence,
  finalizeVerdict,
  hasSufficientData,
  validateCitations,
  type OfferedDatum,
} from "@/lib/ai/analystCore";

function datum(overrides: Partial<OfferedDatum>): OfferedDatum {
  return {
    tag: "STAT-PRICE",
    sourceType: "MARKET_STAT",
    sourceId: "stat1",
    labelKey: "avgSalePrice",
    format: "money",
    value: 100_000,
    promptText: "avg sale price 100000",
    provenance: "OFFICIAL_STAT",
    confidence: 0.8,
    snapshot: { value: 100_000 },
    ...overrides,
  };
}

describe("hasSufficientData (sufficiency gate)", () => {
  test("no data at all is insufficient", () => {
    expect(hasSufficientData([])).toBe(false);
  });

  test("one figure alone is never enough", () => {
    expect(hasSufficientData([datum({})])).toBe(false);
  });

  test("two figures but neither is market-level evidence is insufficient", () => {
    expect(
      hasSufficientData([
        datum({ tag: "LST-SALE", sourceType: "LISTING" }),
        datum({ tag: "FIN-SCORE", sourceType: "PROPERTY" }),
      ]),
    ).toBe(false);
  });

  test("a market stat with zero confidence doesn't count", () => {
    expect(
      hasSufficientData([
        datum({ confidence: 0 }),
        datum({ tag: "LST-SALE", sourceType: "LISTING" }),
      ]),
    ).toBe(false);
  });

  test("market stat + listing price is sufficient", () => {
    expect(
      hasSufficientData([
        datum({}),
        datum({ tag: "LST-SALE", sourceType: "LISTING" }),
      ]),
    ).toBe(true);
  });

  test("a stored valuation also counts as market-level evidence", () => {
    expect(
      hasSufficientData([
        datum({ tag: "VAL-MID", sourceType: "VALUATION" }),
        datum({ tag: "LST-SALE", sourceType: "LISTING" }),
      ]),
    ).toBe(true);
  });
});

describe("validateCitations", () => {
  test("invented tags are dropped; duplicates collapse to one", () => {
    const offered = [datum({}), datum({ tag: "LST-SALE", sourceType: "LISTING" })];
    const valid = validateCitations(
      ["STAT-PRICE", "MADE-UP", "STAT-PRICE", "LST-SALE"],
      offered,
    );
    expect(valid.length).toBe(2);
    expect(valid[0].tag).toBe("STAT-PRICE");
  });
});

describe("capConfidence", () => {
  test("no citations → zero confidence, whatever the model claimed", () => {
    expect(capConfidence(0.9, [])).toBe(0);
  });

  test("capped by the weakest cited figure", () => {
    expect(capConfidence(0.9, [datum({ confidence: 0.7 }), datum({ confidence: 0.3 })])).toBe(0.3);
  });

  test("never above the AI answer cap, even on strong data", () => {
    expect(capConfidence(1, [datum({ confidence: 0.95 })])).toBe(AI_ANSWER_CONFIDENCE_CAP);
  });

  test("out-of-range model values are clamped", () => {
    expect(capConfidence(-1, [datum({ confidence: 0.5 })])).toBe(0);
  });
});

describe("finalizeVerdict", () => {
  test("a BUY with only invented citations is downgraded to INSUFFICIENT_DATA", () => {
    const v = finalizeVerdict(
      { rating: "BUY", confidence: 0.9, answer: "x", citedTags: ["FAKE"] },
      [datum({})],
    );
    expect(v.rating).toBe("INSUFFICIENT_DATA");
    expect(v.confidence).toBe(0);
  });

  test("a supported verdict keeps its rating with capped confidence", () => {
    const v = finalizeVerdict(
      { rating: "CONSIDER", confidence: 0.9, answer: "x", citedTags: ["STAT-PRICE"] },
      [datum({ confidence: 0.6 })],
    );
    expect(v.rating).toBe("CONSIDER");
    expect(v.confidence).toBe(0.6);
    expect(v.citations.length).toBe(1);
  });

  test("the model choosing INSUFFICIENT_DATA is respected and gets zero confidence", () => {
    const v = finalizeVerdict(
      { rating: "INSUFFICIENT_DATA", confidence: 0.4, answer: "x", citedTags: [] },
      [datum({})],
    );
    expect(v.rating).toBe("INSUFFICIENT_DATA");
    expect(v.confidence).toBe(0);
  });
});
