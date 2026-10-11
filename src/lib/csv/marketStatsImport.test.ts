// Market-figure CSV reader tests. Run with: npm test
//
// One check per rule in docs/specs/oman-property/align-3-real-data.md
// ("Behaviour of the parser"), plus every fixture in prisma/fixtures/ giving
// exactly the result its README (and mixed-errors.expected.txt) promises.
// Also proves the honesty rules: the output never carries a provenance, a
// formula-looking cell stays plain text, and oversized files are refused
// before a single row is read.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENCY_CONFIDENCE,
  MAX_CSV_BYTES,
  MAX_ROWS_AGENCY,
  MAX_ROWS_OFFICIAL,
  normalizePlaceName,
  parseMarketStatsCsv,
  readNumber,
  toLatinDigits,
  type ImportMode,
  type ParseResult,
  type PlaceDirectory,
  type PlaceEntry,
} from "./marketStatsImport";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

// The seeded places (prisma/seed.ts) the fixtures use.
const place = (slug: string, nameEn: string, nameAr: string): PlaceEntry => ({
  id: `id-${slug}`,
  slug,
  nameEn,
  nameAr,
});
const SEED_PLACES: PlaceDirectory = {
  governorates: [place("muscat", "Muscat", "مسقط"), place("dhofar", "Dhofar", "ظفار")],
  cities: [
    place("seeb", "Seeb", "السيب"),
    place("bawshar", "Bawshar", "بوشر"),
    place("muttrah", "Muttrah", "مطرح"),
    place("salalah", "Salalah", "صلالة"),
  ],
  neighborhoods: [
    place("al-mouj", "Al Mouj", "الموج"),
    place("muscat-hills", "Muscat Hills", "تلال مسقط"),
    place("al-hail", "Al Hail", "الحيل"),
    place("qurum", "Qurum", "القرم"),
    place("al-khuwair", "Al Khuwair", "الخوير"),
    place("ghubrah", "Al Ghubrah", "الغبرة"),
    place("madinat-sultan-qaboos", "Madinat Sultan Qaboos", "مدينة السلطان قابوس"),
    place("bausher", "Bausher", "بوشر"),
    place("ruwi", "Ruwi", "روي"),
    place("salalah-center", "Salalah Center", "وسط صلالة"),
    place("hawana-salalah", "Hawana Salalah", "هوانا صلالة"),
  ],
};

const FIXTURES = join(process.cwd(), "prisma", "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

function parse(
  text: string,
  { mode = "official", neighborhoodAllowed = false, places = SEED_PLACES }: {
    mode?: ImportMode;
    neighborhoodAllowed?: boolean;
    places?: PlaceDirectory;
  } = {},
): ParseResult {
  return parseMarketStatsCsv(text, { mode, neighborhoodAllowed, places });
}

const errorList = (r: ParseResult) => r.rowErrors.map((e) => `${e.line},${e.column},${e.code}`);
const fileCodes = (r: ParseResult) => r.fileErrors.map((e) => e.code);

const HEADER =
  "area_level,area,property_type,metric,value,period_start,period_type,source_url,source_note,confidence";
const URL = "https://www.ncsi.gov.om/";
function row(fields: Partial<Record<string, string>> = {}): string {
  const d: Record<string, string> = {
    area_level: "governorate",
    area: "muscat",
    property_type: "APARTMENT",
    metric: "avgSalePrice",
    value: "68500.000",
    period_start: "2026-04-01",
    period_type: "",
    source_url: URL,
    source_note: "TEST",
    confidence: "",
    ...fields,
  };
  return HEADER.split(",").map((c) => d[c]).join(",");
}
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n") + "\n";
/** The one error code a single-row file gives, as "column,code". */
function oneError(fields: Partial<Record<string, string>>, opts = {}): string {
  return parse(csv(row(fields)), opts).rowErrors.map((e) => `${e.column},${e.code}`).join(" | ");
}

// ---------- Fixtures ----------

// 1. Good file: 12 figures in 8 groups, no problems.
const good = parse(fixture("market-stats-official-good.csv"));
expectEqual("good file: no problems", [fileCodes(good), errorList(good)], [[], []]);
expectEqual("good file: 12 figures in 8 groups", [good.counts.figures, good.counts.groups, good.counts.rows], [12, 8, 12]);
expectEqual(
  "good file: blank confidence = 0.9, 0.85 kept",
  good.groups.map((g) => g.confidence),
  [0.9, 0.9, 0.9, 0.9, 0.9, 0.85, 0.9, 0.9],
);
expectEqual(
  "good file: Muscat apartments combined into one group",
  good.groups[0].metrics,
  { avgSalePrice: 68500, avgRentMonthly: 345.5, avgPricePerSqm: 742.25 },
);
expectEqual(
  "good file: governorate scope and month",
  [good.groups[0].scope.level, good.groups[0].scope.slug, good.groups[0].periodStart, good.groups[0].propertyType],
  ["governorate", "muscat", "2026-04-01", "APARTMENT"],
);
expectEqual("good file: blank type = all types", good.groups[2].propertyType, null);
expectEqual(
  "good file: quarterly row says so in the note",
  good.groups[0].sourceNote.includes("(quarter starting 2026-04-01)"),
  true,
);
expectEqual("good file: city rows at city level", good.groups[6].scope, {
  level: "city", id: "id-seeb", slug: "seeb", nameEn: "Seeb", nameAr: "السيب",
});

// 2. Bad header.
const badHeader = parse(fixture("market-stats-official-bad-header.csv"));
expectEqual(
  "bad header: value and source_url missing",
  badHeader.fileErrors,
  [{ code: "missingColumn", column: "value" }, { code: "missingColumn", column: "source_url" }],
);
expectEqual(
  "bad header: vaule and notes ignored with a warning",
  badHeader.warnings,
  [{ code: "ignoredColumn", column: "vaule" }, { code: "ignoredColumn", column: "notes" }],
);
expectEqual("bad header: nothing importable", badHeader.groups.length, 0);

// 3. Arabic names (with byte-order mark) = the good file's numbers; Bawshar/Bausher clash.
const arabicText = fixture("market-stats-official-arabic-names.csv");
expectEqual("arabic file starts with a byte-order mark", arabicText.charCodeAt(0), 0xfeff);
const arabic = parse(arabicText);
expectEqual("arabic names: only line 15 refused (neighbourhood not allowed)", errorList(arabic), [
  "15,area_level,neighborhoodNotAllowed",
]);
const stripIds = (r: ParseResult) =>
  r.groups.map((g) => [g.scope.slug, g.propertyType, g.periodStart, g.metrics, g.confidence, g.sourceUrl]);
expectEqual(
  "arabic names: lines 2-13 give the good file's groups",
  stripIds(arabic).slice(0, 8),
  stripIds(good),
);
const arabicTicked = parse(arabicText, { neighborhoodAllowed: true });
expectEqual("arabic names ticked: no problems", errorList(arabicTicked), []);
expectEqual(
  "Bawshar/Bausher clash: same Arabic name, two different places by level",
  arabicTicked.groups.slice(-2).map((g) => [g.scope.level, g.scope.slug]),
  [["city", "bawshar"], ["neighborhood", "bausher"]],
);

// 4. Mixed digits = the good file's numbers exactly.
const digits = parse(fixture("market-stats-official-mixed-digits.csv"));
expectEqual("mixed digits: no problems", [fileCodes(digits), errorList(digits)], [[], []]);
expectEqual("mixed digits: identical numbers and dates to the good file", stripIds(digits), stripIds(good));

// 5. Neighbourhood rows.
const hoodFile = fixture("market-stats-official-neighborhood-row.csv");
expectEqual("neighbourhood rows refused when the box is not ticked", errorList(parse(hoodFile)), [
  "7,area_level,neighborhoodNotAllowed",
  "8,area_level,neighborhoodNotAllowed",
]);
expectEqual("neighbourhood rows: the other five still fine", parse(hoodFile).counts.figures, 5);
const hoodTicked = parse(hoodFile, { neighborhoodAllowed: true });
expectEqual("neighbourhood rows accepted when ticked", [errorList(hoodTicked), hoodTicked.counts.figures], [[], 7]);

// 6. Mixed errors = exactly the expected list.
const expected = fixture("market-stats-official-mixed-errors.expected.txt")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const mixed = parse(fixture("market-stats-official-mixed-errors.csv"));
expectEqual("mixed errors: every expected problem, nothing else", errorList(mixed), expected);
expectEqual("mixed errors: no file errors", mixed.fileErrors, []);
expectEqual(
  "mixed errors: areaNotFound names the level",
  mixed.rowErrors.find((e) => e.code === "areaNotFound"),
  { line: 4, column: "area", code: "areaNotFound", value: "Musandam", level: "governorate" },
);

// 7. Formula-looking cells stay text.
const formula = parse(fixture("market-stats-official-formula.csv"));
expectEqual("formula cells: no problems", errorList(formula), []);
expectEqual(
  "formula cells kept as plain text, never calculated",
  formula.groups.map((g) => g.sourceNote.split(" TEST")[0]),
  ['=HYPERLINK("http://example.com","x")', "+1+1", "@SUM(A1)"],
);
expectEqual("formula in value is not a number", oneError({ value: "=1+1" }), "value,badNumber");

// 8. Semicolons, 9. empty.
expectEqual("semicolons: wrongDelimiter", fileCodes(parse(fixture("market-stats-official-semicolons.csv"))), ["wrongDelimiter"]);
expectEqual("tab-separated: wrongDelimiter", fileCodes(parse(HEADER.replace(/,/g, "\t") + "\n")), ["wrongDelimiter"]);
expectEqual("header only: empty", fileCodes(parse(fixture("market-stats-official-empty.csv"))), ["empty"]);
expectEqual("zero bytes: empty", fileCodes(parse("")), ["empty"]);

// 10. Agency good, 11. agency too many.
const agency = parse(fixture("market-stats-agency-good.csv"), { mode: "agency", neighborhoodAllowed: true });
expectEqual("agency file: 8 accepted", [errorList(agency), agency.counts.figures], [[], 8]);
expectEqual(
  "agency file: confidence column ignored, fixed at 0.5",
  [...new Set(agency.groups.map((g) => g.confidence))],
  [AGENCY_CONFIDENCE],
);
const tooMany = parse(fixture("market-stats-agency-too-many.csv"), { mode: "agency", neighborhoodAllowed: true });
expectEqual("agency 101 rows: tooManyRows (max 100), no row read", [tooMany.fileErrors, tooMany.rowErrors.length, tooMany.groups.length], [[{ code: "tooManyRows", max: MAX_ROWS_AGENCY }], 0, 0]);

// ---------- Limits (built in memory) ----------

const bigNote = "x".repeat(400);
let big = HEADER + "\n";
while (big.length <= MAX_CSV_BYTES) big += row({ source_note: bigNote }) + "\n";
const bigResult = parse(big);
expectEqual("501 KB file refused before any row is read", [fileCodes(bigResult), bigResult.rowErrors.length, bigResult.groups.length], [["fileTooBig"], 0, 0]);
// Arabic letters are two bytes each in UTF-8: 260,000 of them is over 500 KB.
expectEqual("size is counted in UTF-8 bytes", fileCodes(parse(HEADER + "\n" + "ب".repeat(260_000))), ["fileTooBig"]);

const rows2001 = Array.from({ length: MAX_ROWS_OFFICIAL + 1 }, (_, i) =>
  row({ area: i % 2 ? "muscat" : "dhofar", period_start: `${1900 + Math.floor(i / 24)}-${String((i % 12) + 1).padStart(2, "0")}-01`, metric: "transactionCount", value: String(i) }),
);
const r2001 = parse(csv(...rows2001));
expectEqual("2,001-row file refused before any row is read", [r2001.fileErrors, r2001.rowErrors.length], [[{ code: "tooManyRows", max: MAX_ROWS_OFFICIAL }], 0]);
const r2000 = parse(csv(...rows2001.slice(0, MAX_ROWS_OFFICIAL)));
expectEqual("2,000 rows allowed", fileCodes(r2000), []);

// ---------- Reader rules ----------

expectEqual("byte-order mark stripped", errorList(parse("﻿" + csv(row()))), []);
expectEqual("\\r\\n line ends", errorList(parse(csv(row()).replace(/\n/g, "\r\n"))), []);
expectEqual(
  "quoted field with comma, doubled quote and a line break",
  parse(csv(row({ source_note: '"a, ""b""\nc"' }))).groups[0].sourceNote,
  'a, "b"\nc',
);
expectEqual(
  "line numbers count a quoted line break as one row",
  errorList(parse(csv(row({ source_note: '"x\ny"' }), row({ value: "abc", metric: "avgRentMonthly" })))),
  ["3,value,badNumber"],
);
expectEqual("unclosed quote: notCsv", fileCodes(parse(csv(row({ source_note: '"open' })))), ["notCsv"]);
expectEqual("binary (NUL byte): notCsv", fileCodes(parse("PK\u0000\u0003")), ["notCsv"]);
expectEqual("not UTF-8 (replacement characters): notUtf8", fileCodes(parse(csv(row({ area: "��" })))), ["notUtf8"]);
expectEqual(
  "headers: trimmed and any capitals",
  errorList(parse(HEADER.split(",").map((h) => ` ${h.toUpperCase()} `).join(",") + "\n" + row())),
  [],
);
expectEqual("duplicate column", parse(HEADER + ",Value\n" + row()).fileErrors, [{ code: "duplicateColumn", column: "Value" }]);
expectEqual(
  "optional columns may be absent",
  errorList(parse("area_level,area,metric,value,period_start,source_url\ngovernorate,muscat,avgSalePrice,1,2026-01-01," + URL + "\n")),
  [],
);
expectEqual("blank lines are skipped", parse(csv(row(), "", row({ metric: "avgRentMonthly" }))).counts.figures, 2);

// Required cells
for (const col of ["area_level", "area", "metric", "value", "period_start", "source_url"]) {
  expectEqual(`required: ${col}`, oneError({ [col]: "" }), `${col},required`);
}

// Levels and places
expectEqual("bad level", oneError({ area_level: "district" }), "area_level,badAreaLevel");
expectEqual("place looked up only inside its level", oneError({ area_level: "city", area: "muscat" }), "area,areaNotFound");
expectEqual("slug, English or Arabic name all match", ["muscat", "MUSCAT", "  Muscat ", "مسقط"].map((a) => oneError({ area: a })), ["", "", "", ""]);
expectEqual("Arabic tatweel and short vowels ignored", oneError({ area: "مَسْـقط" }), "");
expectEqual("spaces collapsed", oneError({ area_level: "neighborhood", area: "Al   Mouj" }, { neighborhoodAllowed: true }), "");
expectEqual("nothing fuzzier: a misspelling is not guessed", oneError({ area: "Muskat" }), "area,areaNotFound");
expectEqual("normalizePlaceName", normalizePlaceName("  Al  KHUWAIR "), "al khuwair");
const INVENTED: PlaceDirectory = {
  governorates: [],
  cities: [],
  neighborhoods: [
    { id: "n1", slug: "al-noor-east", nameEn: "Al Noor", nameAr: "النور" },
    { id: "n2", slug: "al-noor-west", nameEn: "Al Noor", nameAr: "النور" },
  ],
};
expectEqual(
  "areaAmbiguous: one name, two places at the same level",
  parse(csv(row({ area_level: "neighborhood", area: "Al Noor" })), { places: INVENTED, neighborhoodAllowed: true }).rowErrors,
  [{ line: 2, column: "area", code: "areaAmbiguous", value: "Al Noor", level: "neighborhood" }],
);
expectEqual(
  "areaAmbiguous: the slug resolves it",
  oneError({ area_level: "neighborhood", area: "al-noor-east" }, { places: INVENTED, neighborhoodAllowed: true }),
  "",
);
expectEqual(
  "neighbourhood row refused unless allowed",
  oneError({ area_level: "neighborhood", area: "qurum" }),
  "area_level,neighborhoodNotAllowed",
);

// Types and metrics
expectEqual("bad property type", oneError({ property_type: "FLAT" }), "property_type,badPropertyType");
expectEqual("property type any capitals", parse(csv(row({ property_type: "villa" }))).groups[0].propertyType, "VILLA");
expectEqual("unknown metric (not silently dropped)", oneError({ metric: "totalValue" }), "metric,badMetric");

// Digits and numbers
expectEqual("Arabic-Indic digits and decimal mark", toLatinDigits("٣٤٥٫٥٠٠"), "345.500");
expectEqual("Eastern Arabic-Indic digits", toLatinDigits("۱۲۳٫۵"), "123.5");
expectEqual("mixed scripts in one value", readNumber("١٢3.٥٠٠"), { value: 123.5, decimals: 3 });
expectEqual("comma thousands in groups of three", readNumber("1,250,000.500"), { value: 1250000.5, decimals: 3 });
expectEqual("Arabic thousands mark", readNumber("١٬٢٥٠"), { value: 1250, decimals: 0 });
expectEqual("space thousands", readNumber("1 250"), { value: 1250, decimals: 0 });
expectEqual("thousands separator NOT in groups of three is refused", readNumber("12,50"), null);
expectEqual("text columns not touched by digit conversion", parse(csv(row({ source_note: "ملاحظة ١٢٣" }))).groups[0].sourceNote, "ملاحظة ١٢٣");
expectEqual("money: zero refused", oneError({ value: "0" }), "value,outOfRange");
expectEqual("money: negative refused", oneError({ value: "-5" }), "value,outOfRange");
expectEqual("money: above 100,000,000 refused", oneError({ value: "100000000.001" }), "value,outOfRange");
expectEqual("money: 100,000,000 allowed", oneError({ value: "100000000" }), "");
expectEqual("money: 4 decimals refused", oneError({ value: "1.2345" }), "value,tooManyDecimals");
expectEqual("yield 0-100, rounded to 2 decimals", parse(csv(row({ metric: "grossYieldPct", value: "5.456" }))).groups[0].metrics, { grossYieldPct: 5.46 });
expectEqual("yield above 100 refused", oneError({ metric: "grossYieldPct", value: "100.5" }), "value,outOfRange");
expectEqual("count must be whole", oneError({ metric: "transactionCount", value: "12.5" }), "value,outOfRange");
expectEqual("count 0 allowed", oneError({ metric: "sampleSize", value: "0" }), "");
expectEqual("count negative refused", oneError({ metric: "transactionCount", value: "-1" }), "value,outOfRange");

// Dates and periods
expectEqual("date: day must be 01", oneError({ period_start: "2026-01-15" }), "period_start,badDate");
expectEqual("date: other formats refused", oneError({ period_start: "01/04/2026" }), "period_start,badDate");
expectEqual("date: month 13 refused", oneError({ period_start: "2026-13-01" }), "period_start,badDate");
expectEqual("date: Arabic digits", parse(csv(row({ period_start: "٢٠٢٦-٠٤-٠١" }))).groups[0].periodStart, "2026-04-01");
expectEqual("bad period type", oneError({ period_type: "weekly" }), "period_type,badPeriodType");
expectEqual("month adds no note suffix", parse(csv(row({ period_type: "month" }))).groups[0].sourceNote, "TEST");
expectEqual("year adds a note suffix", parse(csv(row({ period_type: "year", period_start: "2026-01-01" }))).groups[0].sourceNote, "TEST (year starting 2026-01-01)");

// Source link, note, confidence
expectEqual("url must start http(s)://", oneError({ source_url: "www.ncsi.gov.om" }), "source_url,badUrl");
expectEqual("javascript: url refused", oneError({ source_url: "javascript:alert(1)" }), "source_url,badUrl");
expectEqual("url over 500 characters", oneError({ source_url: "https://a.om/" + "x".repeat(500) }), "source_url,tooLong");
expectEqual("note over 500 characters", oneError({ source_note: "x".repeat(501) }), "source_note,tooLong");
expectEqual("note at 500 before the suffix pushes it over", oneError({ source_note: "x".repeat(490), period_type: "quarter" }), "source_note,tooLong");
expectEqual("confidence above 1", oneError({ confidence: "1.5" }), "confidence,badConfidence");
expectEqual("confidence not a number", oneError({ confidence: "high" }), "confidence,badConfidence");
expectEqual("confidence Arabic digits", parse(csv(row({ confidence: "٠٫٨٥" }))).groups[0].confidence, 0.85);
expectEqual("agency mode ignores even a bad confidence", oneError({ confidence: "9" }, { mode: "agency" }), "");

// Duplicates and groups
expectEqual(
  "duplicate figure: both lines refused",
  errorList(parse(csv(row(), row({ source_note: "again" })))),
  ["2,,duplicateRow", "3,,duplicateRow"],
);
expectEqual(
  "same group, different confidence: later line refused",
  errorList(parse(csv(row({ confidence: "0.8" }), row({ metric: "avgRentMonthly", confidence: "0.7" })))),
  ["3,confidence,conflictingGroup"],
);
expectEqual(
  "different months are different groups",
  parse(csv(row(), row({ period_start: "2026-05-01" }))).counts.groups,
  2,
);
const combinedNotes = parse(csv(row({ source_note: "A" }), row({ metric: "avgRentMonthly", source_note: "B" }))).groups[0];
expectEqual("combined notes name each figure", combinedNotes.sourceNote, "avgSalePrice: A; avgRentMonthly: B");
expectEqual("group lists its lines", combinedNotes.lines, [2, 3]);

// ---------- Honesty: a file can never ask for a provenance ----------

const sneaky = parse(HEADER + ",provenance,verified\n" + row() + ",OFFICIAL_STAT,VERIFIED\n", { mode: "agency" });
expectEqual("provenance column ignored with a warning", sneaky.warnings.map((w) => w.column), ["provenance", "verified"]);
for (const [label, result] of [["good", good], ["agency", agency], ["sneaky", sneaky]] as const) {
  const json = JSON.stringify(result.groups);
  expectEqual(
    `${label}: no provenance anywhere in the output`,
    [/provenance/i.test(json), /OFFICIAL_STAT|VERIFIED|USER_SUBMITTED|AI_ESTIMATED/.test(json)],
    [false, false],
  );
}
expectEqual(
  "group keys are exactly the agreed shape",
  Object.keys(good.groups[0]).sort(),
  ["confidence", "lines", "metrics", "periodStart", "propertyType", "scope", "sourceNote", "sourceUrl"],
);
expectEqual("result keys are exactly the agreed shape", Object.keys(good).sort(), ["counts", "fileErrors", "groups", "rowErrors", "warnings"]);

if (failures > 0) {
  console.error(`\n${failures} CSV import check(s) failed`);
  process.exit(1);
}
console.log("\nAll CSV import checks passed.");
