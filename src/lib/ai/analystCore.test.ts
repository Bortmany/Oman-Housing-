// Honesty-rule tests for the AI analyst. Run with: npm test
import {
  AI_ANSWER_CONFIDENCE_CAP,
  capConfidence,
  finalizeVerdict,
  hasSufficientData,
  validateCitations,
  type OfferedDatum,
} from "./analystCore";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

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

// --- Sufficiency gate ---

// No data at all → insufficient
expectEqual("sufficiency.empty", hasSufficientData([]), false);

// One figure alone is never enough
expectEqual(
  "sufficiency.single",
  hasSufficientData([datum({})]),
  false,
);

// Two figures but neither is market-level evidence → insufficient
expectEqual(
  "sufficiency.noMarketEvidence",
  hasSufficientData([
    datum({ tag: "LST-SALE", sourceType: "LISTING" }),
    datum({ tag: "FIN-SCORE", sourceType: "PROPERTY" }),
  ]),
  false,
);

// A market stat with zero confidence doesn't count
expectEqual(
  "sufficiency.zeroConfidence",
  hasSufficientData([
    datum({ confidence: 0 }),
    datum({ tag: "LST-SALE", sourceType: "LISTING" }),
  ]),
  false,
);

// Market stat + listing price → sufficient
expectEqual(
  "sufficiency.ok",
  hasSufficientData([
    datum({}),
    datum({ tag: "LST-SALE", sourceType: "LISTING" }),
  ]),
  true,
);

// A stored valuation also counts as market-level evidence
expectEqual(
  "sufficiency.valuation",
  hasSufficientData([
    datum({ tag: "VAL-MID", sourceType: "VALUATION" }),
    datum({ tag: "LST-SALE", sourceType: "LISTING" }),
  ]),
  true,
);

// --- Citation validation ---

{
  const offered = [datum({}), datum({ tag: "LST-SALE", sourceType: "LISTING" })];
  // Invented tags are dropped; duplicates collapse to one
  const valid = validateCitations(
    ["STAT-PRICE", "MADE-UP", "STAT-PRICE", "LST-SALE"],
    offered,
  );
  expectEqual("citations.dropInvented", valid.length, 2);
  expectEqual("citations.order", valid[0].tag, "STAT-PRICE");
}

// --- Confidence capping ---

// No citations → zero confidence, whatever the model claimed
expectEqual("confidence.noCitations", capConfidence(0.9, []), 0);

// Capped by the weakest cited figure
expectEqual(
  "confidence.weakestWins",
  capConfidence(0.9, [datum({ confidence: 0.7 }), datum({ confidence: 0.3 })]),
  0.3,
);

// Never above the AI answer cap, even on strong data
expectEqual(
  "confidence.aiCap",
  capConfidence(1, [datum({ confidence: 0.95 })]),
  AI_ANSWER_CONFIDENCE_CAP,
);

// Out-of-range model values are clamped
expectEqual(
  "confidence.clampNegative",
  capConfidence(-1, [datum({ confidence: 0.5 })]),
  0,
);

// --- Final verdict rules ---

{
  // A BUY with only invented citations is downgraded to INSUFFICIENT_DATA
  const v = finalizeVerdict(
    { rating: "BUY", confidence: 0.9, answer: "x", citedTags: ["FAKE"] },
    [datum({})],
  );
  expectEqual("verdict.downgradeUnsupported", v.rating, "INSUFFICIENT_DATA");
  expectEqual("verdict.downgradeConfidence", v.confidence, 0);
}

{
  // A supported verdict keeps its rating with capped confidence
  const v = finalizeVerdict(
    { rating: "CONSIDER", confidence: 0.9, answer: "x", citedTags: ["STAT-PRICE"] },
    [datum({ confidence: 0.6 })],
  );
  expectEqual("verdict.supportedRating", v.rating, "CONSIDER");
  expectEqual("verdict.supportedConfidence", v.confidence, 0.6);
  expectEqual("verdict.citationsKept", v.citations.length, 1);
}

{
  // The model choosing INSUFFICIENT_DATA is respected and gets zero confidence
  const v = finalizeVerdict(
    { rating: "INSUFFICIENT_DATA", confidence: 0.4, answer: "x", citedTags: [] },
    [datum({})],
  );
  expectEqual("verdict.modelDeclines", v.rating, "INSUFFICIENT_DATA");
  expectEqual("verdict.modelDeclinesConfidence", v.confidence, 0);
}

if (failures > 0) {
  console.error(`\n${failures} analyst test(s) failed`);
  process.exit(1);
}
console.log("\nAll analyst tests passed.");
