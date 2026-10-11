// The ONE reader for market-figure CSV uploads (Align Step 3). Pure: no I/O,
// no database, no `@/` imports (the tsx test runner cannot resolve them).
// Tested in marketStatsImport.test.ts (runs in `npm test`).
//
// Used by the admin bulk upload (/admin/market-stats/import) and the agency
// data upload (/agency/data). The contract both callers rely on — keep these
// names and shapes stable:
//
//   parseMarketStatsCsv(text, { mode, neighborhoodAllowed, places }) → ParseResult
//     text                 the whole file as a string (decoded as UTF-8)
//     mode                 "official" | "agency"
//                          official: at most MAX_ROWS_OFFICIAL rows, the
//                                    `confidence` column is read (default 0.9)
//                          agency:   at most MAX_ROWS_AGENCY rows, the
//                                    `confidence` column is ignored and fixed
//                                    at AGENCY_CONFIDENCE (0.5)
//     neighborhoodAllowed  false → any `neighborhood` row is rejected
//                          (`neighborhoodNotAllowed`, column `area_level`)
//     places               { governorates, cities, neighborhoods }, each a list
//                          of { id, slug, nameEn, nameAr } loaded by the caller
//
//   ParseResult = { fileErrors, rowErrors, groups, warnings, counts }
//     fileErrors  FileError[]   whole-file problems; when present nothing else
//                               is filled in (no rows were read)
//     rowErrors   RowError[]    { line, column, code, value, level? }; line is
//                               the Excel row number (header = 1), column is
//                               the header name exactly as in the file ("" for
//                               a whole-line problem such as duplicateRow)
//     groups      ImportGroup[] one future save each: rows for the same place +
//                               property type + month combined. A group carries
//                               NO provenance — the caller decides that; a file
//                               can never ask for one.
//     warnings    ImportWarning[] non-blocking (unused columns)
//     counts      { rows, figures, groups, problems }
//
// Every cell is plain text. Nothing is ever evaluated: a cell starting with
// `=`, `+`, `-` or `@` stays text (a leading `-` on a number is then refused as
// out of range). Import must be refused while fileErrors or rowErrors is
// non-empty (all-or-nothing).

// ---------- Limits ----------

/** 500 KB: keeps the check-then-confirm round trip well inside Next 16's
 *  default 1 MB server-action body limit (node_modules/next/dist/docs/01-app/
 *  02-guides/server-actions.md, "Body size limit"). */
export const MAX_CSV_BYTES = 500 * 1024;
export const MAX_ROWS_OFFICIAL = 2000;
export const MAX_ROWS_AGENCY = 100;
export const DEFAULT_OFFICIAL_CONFIDENCE = 0.9;
/** The app's existing default for user-submitted data. */
export const AGENCY_CONFIDENCE = 0.5;
const MAX_TEXT = 500;
const MAX_MONEY = 100_000_000;
const MAX_INT = 2_147_483_647;

// ---------- Vocabulary (fixed by docs/decisions/official-data-sources.md) ----------

export const CSV_COLUMNS = [
  "area_level",
  "area",
  "property_type",
  "metric",
  "value",
  "period_start",
  "period_type",
  "source_url",
  "source_note",
  "confidence",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const REQUIRED_COLUMNS = [
  "area_level",
  "area",
  "metric",
  "value",
  "period_start",
  "source_url",
] as const satisfies ReadonlyArray<CsvColumn>;

export const AREA_LEVELS = ["governorate", "city", "neighborhood"] as const;
export type AreaLevel = (typeof AREA_LEVELS)[number];

export const CSV_PROPERTY_TYPES = [
  "APARTMENT",
  "VILLA",
  "TOWNHOUSE",
  "PENTHOUSE",
  "LAND",
  "OFFICE",
  "RETAIL",
  "WAREHOUSE",
] as const;
export type CsvPropertyType = (typeof CSV_PROPERTY_TYPES)[number];

export const CSV_METRICS = [
  "avgSalePrice",
  "medianSalePrice",
  "avgRentMonthly",
  "avgPricePerSqm",
  "grossYieldPct",
  "transactionCount",
  "sampleSize",
] as const;
export type CsvMetric = (typeof CSV_METRICS)[number];

const MONEY_METRICS: ReadonlySet<CsvMetric> = new Set([
  "avgSalePrice",
  "medianSalePrice",
  "avgRentMonthly",
  "avgPricePerSqm",
]);
const COUNT_METRICS: ReadonlySet<CsvMetric> = new Set([
  "transactionCount",
  "sampleSize",
]);

export const PERIOD_TYPES = ["month", "quarter", "year"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

// ---------- Public types ----------

export type ImportMode = "official" | "agency";

export type PlaceEntry = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
};

export type PlaceDirectory = {
  governorates: PlaceEntry[];
  cities: PlaceEntry[];
  neighborhoods: PlaceEntry[];
};

export type ParseOptions = {
  mode: ImportMode;
  neighborhoodAllowed: boolean;
  places: PlaceDirectory;
};

export type FileErrorCode =
  | "fileTooBig"
  | "tooManyRows"
  | "notCsv"
  | "notUtf8"
  | "wrongDelimiter"
  | "empty"
  | "missingColumn"
  | "duplicateColumn";

/** `column` for missingColumn/duplicateColumn; `max` for tooManyRows. */
export type FileError = { code: FileErrorCode; column?: string; max?: number };

export type RowErrorCode =
  | "required"
  | "badAreaLevel"
  | "areaNotFound"
  | "areaAmbiguous"
  | "neighborhoodNotAllowed"
  | "badPropertyType"
  | "badMetric"
  | "badNumber"
  | "outOfRange"
  | "tooManyDecimals"
  | "badDate"
  | "badPeriodType"
  | "badUrl"
  | "badConfidence"
  | "tooLong"
  | "duplicateRow"
  | "conflictingGroup";

/** `level` is set for areaNotFound / areaAmbiguous (their sentence names it). */
export type RowError = {
  line: number;
  column: string;
  code: RowErrorCode;
  value: string;
  level?: AreaLevel;
};

export type ImportWarning = { code: "ignoredColumn"; column: string };

export type ImportScope = {
  level: AreaLevel;
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
};

/** Same field names as MarketStatMetrics (src/lib/db/marketStatData.ts). */
export type ParsedMetrics = Partial<Record<CsvMetric, number>>;

export type ImportGroup = {
  scope: ImportScope;
  /** null = all property types */
  propertyType: CsvPropertyType | null;
  /** "YYYY-MM-01" (UTC month start) */
  periodStart: string;
  metrics: ParsedMetrics;
  confidence: number;
  sourceUrl: string;
  /** The file's notes (plus "(quarter starting …)" suffixes); may be "". */
  sourceNote: string;
  /** Excel line numbers of the rows combined into this group. */
  lines: number[];
};

export type ImportCounts = {
  /** Non-blank data rows in the file. */
  rows: number;
  /** Figures (one per accepted row) across all groups. */
  figures: number;
  groups: number;
  /** fileErrors + rowErrors. */
  problems: number;
};

export type ParseResult = {
  fileErrors: FileError[];
  rowErrors: RowError[];
  groups: ImportGroup[];
  warnings: ImportWarning[];
  counts: ImportCounts;
};

// ---------- Small pure helpers (exported for tests and callers) ----------

/** Size of the text once saved as UTF-8, without needing TextEncoder. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Arabic-Indic (U+0660–0669) and Eastern Arabic-Indic (U+06F0–06F9) digits →
 * Latin; the Arabic decimal mark (U+066B) → ".". The Arabic thousands mark
 * (U+066C) is left for the number reader to treat as a thousands separator.
 */
export function toLatinDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);
    else if (c >= 0x06f0 && c <= 0x06f9) out += String(c - 0x06f0);
    else if (c === 0x066b) out += ".";
    else out += ch;
  }
  return out;
}

/**
 * Read a number cell. Accepts Latin/Arabic digits (mixed), one decimal point,
 * and — only in groups of three — a comma, space or Arabic thousands mark as
 * thousands separator. Returns null for anything else ("abc", "=1+1", "+5").
 */
export function readNumber(
  raw: string,
): { value: number; decimals: number } | null {
  const s = toLatinDigits(raw.trim());
  let plain: string;
  if (/^-?\d+(?:\.\d+)?$/.test(s) || /^-?\.\d+$/.test(s)) {
    plain = s;
  } else if (/^-?\d{1,3}(?:[,٬  ]\d{3})+(?:\.\d+)?$/.test(s)) {
    plain = s.replace(/[,٬  ]/g, "");
  } else {
    return null;
  }
  const value = Number(plain);
  if (!Number.isFinite(value)) return null;
  const dot = plain.indexOf(".");
  return { value, decimals: dot === -1 ? 0 : plain.length - dot - 1 };
}

/**
 * Place-name comparison form: trimmed, spaces collapsed, lower case, Arabic
 * tatweel and short-vowel marks removed. Nothing fuzzier (no spelling guesses).
 */
export function normalizePlaceName(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[\u0640\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ---------- The CSV tokenizer ----------

type CsvRecord = { line: number; fields: string[] };

/**
 * Comma-separated, double-quoted fields with "" for a literal quote, line
 * breaks allowed inside quotes, \r\n / \n / \r line ends. `line` is the Excel
 * row number of the record (a record with an embedded line break still counts
 * as one row). Stops early once `stopAfterRecords` non-blank records exist.
 * Returns null when a quote is never closed.
 */
function tokenize(text: string, stopAfterRecords: number): CsvRecord[] | null {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false; // any character seen in this field
  let row = 1;
  let nonBlank = 0;

  const endRecord = () => {
    fields.push(field);
    const blank = fields.length === 1 && fields[0].trim() === "";
    if (!blank) {
      records.push({ line: row, fields });
      nonBlank++;
    }
    fields = [];
    field = "";
    fieldStarted = false;
    row++;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
      fieldStarted = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      if (nonBlank > stopAfterRecords) return records;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (inQuotes) return null;
  if (field !== "" || fields.length > 0) endRecord();
  return records;
}

// ---------- The parser ----------

function emptyResult(fileErrors: FileError[], warnings: ImportWarning[] = []): ParseResult {
  return {
    fileErrors,
    rowErrors: [],
    groups: [],
    warnings,
    counts: { rows: 0, figures: 0, groups: 0, problems: fileErrors.length },
  };
}

type PlaceIndex = Record<AreaLevel, Map<string, Map<string, PlaceEntry>>>;

function buildPlaceIndex(places: PlaceDirectory): PlaceIndex {
  const index = {
    governorate: new Map(),
    city: new Map(),
    neighborhood: new Map(),
  } as PlaceIndex;
  const add = (level: AreaLevel, list: PlaceEntry[]) => {
    for (const p of list) {
      for (const name of [p.slug, p.nameEn, p.nameAr]) {
        if (!name) continue;
        const key = normalizePlaceName(name);
        if (!key) continue;
        const hits = index[level].get(key) ?? new Map<string, PlaceEntry>();
        hits.set(p.id, p);
        index[level].set(key, hits);
      }
    }
  };
  add("governorate", places.governorates);
  add("city", places.cities);
  add("neighborhood", places.neighborhoods);
  return index;
}

type ValidRow = {
  line: number;
  scope: ImportScope;
  propertyType: CsvPropertyType | null;
  periodStart: string;
  metric: CsvMetric;
  value: number;
  confidence: number;
  confidenceRaw: string;
  sourceUrl: string;
  sourceUrlRaw: string;
  note: string;
};

function isWebAddress(s: string): boolean {
  if (!/^https?:\/\/[^\s]+$/i.test(s)) return false;
  try {
    const url = new URL(s);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export function parseMarketStatsCsv(
  text: string,
  { mode, neighborhoodAllowed, places }: ParseOptions,
): ParseResult {
  const maxRows = mode === "agency" ? MAX_ROWS_AGENCY : MAX_ROWS_OFFICIAL;

  // 1. Whole-file refusals, before any row is read.
  if (utf8ByteLength(text) > MAX_CSV_BYTES) return emptyResult([{ code: "fileTooBig" }]);
  if (text.includes("\u0000")) return emptyResult([{ code: "notCsv" }]);
  if (text.includes("�")) return emptyResult([{ code: "notUtf8" }]);
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (body.trim() === "") return emptyResult([{ code: "empty" }]);

  // Header + at most maxRows data rows; one more means "too many".
  const records = tokenize(body, maxRows + 1);
  if (!records) return emptyResult([{ code: "notCsv" }]);
  if (records.length === 0) return emptyResult([{ code: "empty" }]);

  const header = records[0];
  if (header.fields.length === 1 && /[;\t]/.test(header.fields[0])) {
    return emptyResult([{ code: "wrongDelimiter" }]);
  }
  if (records.length - 1 > maxRows) return emptyResult([{ code: "tooManyRows", max: maxRows }]);

  // 2. Header: trimmed, capitals ignored. Extra columns are warnings only.
  const fileErrors: FileError[] = [];
  const warnings: ImportWarning[] = [];
  const columnIndex = new Map<CsvColumn, number>();
  const columnLabel = new Map<CsvColumn, string>();
  header.fields.forEach((rawName, i) => {
    const name = rawName.trim();
    const key = name.toLowerCase() as CsvColumn;
    if ((CSV_COLUMNS as readonly string[]).includes(key)) {
      if (columnIndex.has(key)) {
        if (!fileErrors.some((e) => e.code === "duplicateColumn" && e.column === key)) {
          fileErrors.push({ code: "duplicateColumn", column: name });
        }
      } else {
        columnIndex.set(key, i);
        columnLabel.set(key, name);
      }
    } else if (name !== "") {
      warnings.push({ code: "ignoredColumn", column: name });
    }
  });
  for (const col of REQUIRED_COLUMNS) {
    if (!columnIndex.has(col)) fileErrors.push({ code: "missingColumn", column: col });
  }
  if (fileErrors.length > 0) return emptyResult(fileErrors, warnings);

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) return emptyResult([{ code: "empty" }], warnings);

  // 3. Each row on its own.
  const placeIndex = buildPlaceIndex(places);
  const rowErrors: RowError[] = [];
  const validRows: ValidRow[] = [];
  const label = (col: CsvColumn) => columnLabel.get(col) ?? col;

  for (const rec of dataRecords) {
    const line = rec.line;
    const raw = (col: CsvColumn): string => {
      const i = columnIndex.get(col);
      return i == null ? "" : (rec.fields[i] ?? "");
    };
    const errors: RowError[] = [];
    const fail = (col: CsvColumn, code: RowErrorCode, extra: Partial<RowError> = {}) =>
      errors.push({ line, column: label(col), code, value: raw(col), ...extra });

    // Required cells.
    for (const col of REQUIRED_COLUMNS) {
      if (raw(col).trim() === "") fail(col, "required");
    }
    const has = (col: CsvColumn) => raw(col).trim() !== "";

    // area_level + area
    let level: AreaLevel | null = null;
    if (has("area_level")) {
      const l = raw("area_level").trim().toLowerCase();
      if ((AREA_LEVELS as readonly string[]).includes(l)) level = l as AreaLevel;
      else fail("area_level", "badAreaLevel");
    }
    if (level === "neighborhood" && !neighborhoodAllowed) {
      fail("area_level", "neighborhoodNotAllowed");
    }
    let scope: ImportScope | null = null;
    if (level && has("area")) {
      const hits = placeIndex[level].get(normalizePlaceName(raw("area")));
      if (!hits || hits.size === 0) fail("area", "areaNotFound", { level });
      else if (hits.size > 1) fail("area", "areaAmbiguous", { level });
      else {
        const p = [...hits.values()][0];
        scope = { level, id: p.id, slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr };
      }
    }

    // property_type (blank = all types)
    let propertyType: CsvPropertyType | null = null;
    if (has("property_type")) {
      const t = raw("property_type").trim().toUpperCase();
      if ((CSV_PROPERTY_TYPES as readonly string[]).includes(t)) propertyType = t as CsvPropertyType;
      else fail("property_type", "badPropertyType");
    }

    // metric
    let metric: CsvMetric | null = null;
    if (has("metric")) {
      const m = raw("metric").trim().toLowerCase();
      metric = CSV_METRICS.find((x) => x.toLowerCase() === m) ?? null;
      if (!metric) fail("metric", "badMetric");
    }

    // value
    let value: number | null = null;
    if (has("value")) {
      const n = readNumber(raw("value"));
      if (!n) fail("value", "badNumber");
      else if (metric && MONEY_METRICS.has(metric)) {
        if (n.decimals > 3) fail("value", "tooManyDecimals");
        else if (n.value <= 0 || n.value > MAX_MONEY) fail("value", "outOfRange");
        else value = n.value;
      } else if (metric === "grossYieldPct") {
        if (n.value < 0 || n.value > 100) fail("value", "outOfRange");
        else value = Math.round(n.value * 100) / 100;
      } else if (metric && COUNT_METRICS.has(metric)) {
        if (!Number.isInteger(n.value) || n.value < 0 || n.value > MAX_INT) fail("value", "outOfRange");
        else value = n.value;
      }
    }

    // period_start: YYYY-MM-01 only
    let periodStart: string | null = null;
    if (has("period_start")) {
      const s = toLatinDigits(raw("period_start").trim());
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const year = m ? Number(m[1]) : 0;
      const month = m ? Number(m[2]) : 0;
      if (!m || m[3] !== "01" || month < 1 || month > 12 || year < 1900 || year > 2100) {
        fail("period_start", "badDate");
      } else {
        periodStart = s;
      }
    }

    // period_type (blank = month)
    let periodType: PeriodType = "month";
    if (has("period_type")) {
      const p = raw("period_type").trim().toLowerCase();
      if ((PERIOD_TYPES as readonly string[]).includes(p)) periodType = p as PeriodType;
      else fail("period_type", "badPeriodType");
    }

    // source_url
    let sourceUrl: string | null = null;
    if (has("source_url")) {
      const u = raw("source_url").trim();
      if (u.length > MAX_TEXT) fail("source_url", "tooLong");
      else if (!isWebAddress(u)) fail("source_url", "badUrl");
      else sourceUrl = u;
    }

    // source_note (+ the period suffix the parser adds)
    const noteRaw = raw("source_note").trim();
    const suffix =
      periodType !== "month" && periodStart ? `(${periodType} starting ${periodStart})` : "";
    const note = [noteRaw, suffix].filter(Boolean).join(" ");
    if (note.length > MAX_TEXT) fail("source_note", "tooLong");

    // confidence
    let confidence = mode === "agency" ? AGENCY_CONFIDENCE : DEFAULT_OFFICIAL_CONFIDENCE;
    if (mode === "official" && has("confidence")) {
      const n = readNumber(raw("confidence"));
      if (!n || n.value < 0 || n.value > 1) fail("confidence", "badConfidence");
      else confidence = n.value;
    }

    if (errors.length > 0) {
      rowErrors.push(...errors);
      continue;
    }
    validRows.push({
      line,
      scope: scope!,
      propertyType,
      periodStart: periodStart!,
      metric: metric!,
      value: value!,
      confidence,
      confidenceRaw: mode === "official" ? raw("confidence") : "",
      sourceUrl: sourceUrl!,
      sourceUrlRaw: raw("source_url"),
      note,
    });
  }

  // 4. The same place + type + month + figure twice → every such line refused.
  const groupKey = (r: ValidRow) =>
    `${r.scope.level}:${r.scope.id}|${r.propertyType ?? ""}|${r.periodStart}`;
  const figureCount = new Map<string, number>();
  for (const r of validRows) {
    const k = `${groupKey(r)}|${r.metric}`;
    figureCount.set(k, (figureCount.get(k) ?? 0) + 1);
  }
  const unique: ValidRow[] = [];
  for (const r of validRows) {
    if ((figureCount.get(`${groupKey(r)}|${r.metric}`) ?? 0) > 1) {
      rowErrors.push({ line: r.line, column: "", code: "duplicateRow", value: "" });
    } else {
      unique.push(r);
    }
  }

  // 5. Combine into groups; members must share source link and confidence.
  const groupRows = new Map<string, ValidRow[]>();
  for (const r of unique) {
    const k = groupKey(r);
    const members = groupRows.get(k);
    if (!members) {
      groupRows.set(k, [r]);
      continue;
    }
    const first = members[0];
    if (r.sourceUrl !== first.sourceUrl) {
      rowErrors.push({ line: r.line, column: label("source_url"), code: "conflictingGroup", value: r.sourceUrlRaw });
    } else if (r.confidence !== first.confidence) {
      rowErrors.push({ line: r.line, column: label("confidence"), code: "conflictingGroup", value: r.confidenceRaw });
    } else {
      members.push(r);
    }
  }

  const groups: ImportGroup[] = [];
  let figures = 0;
  for (const members of groupRows.values()) {
    const first = members[0];
    const metrics: ParsedMetrics = {};
    for (const r of members) metrics[r.metric] = r.value;
    const notes = [...new Set(members.map((r) => r.note).filter(Boolean))];
    const sourceNote =
      notes.length <= 1
        ? (notes[0] ?? "")
        : members
            .filter((r) => r.note)
            .map((r) => `${r.metric}: ${r.note}`)
            .join("; ");
    figures += members.length;
    groups.push({
      scope: first.scope,
      propertyType: first.propertyType,
      periodStart: first.periodStart,
      metrics,
      confidence: first.confidence,
      sourceUrl: first.sourceUrl,
      sourceNote,
      lines: members.map((r) => r.line),
    });
  }

  const columnOrder = (c: string) => {
    const i = (CSV_COLUMNS as readonly string[]).indexOf(c.toLowerCase());
    return i === -1 ? -1 : i;
  };
  rowErrors.sort((a, b) => a.line - b.line || columnOrder(a.column) - columnOrder(b.column));

  return {
    fileErrors: [],
    rowErrors,
    groups,
    warnings,
    counts: {
      rows: dataRecords.length,
      figures,
      groups: groups.length,
      problems: rowErrors.length,
    },
  };
}
