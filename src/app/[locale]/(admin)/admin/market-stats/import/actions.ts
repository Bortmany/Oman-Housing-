"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { DataProvenance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MARKET_DATA_CACHE_TAG,
  upsertMarketStat,
} from "@/lib/db/market-stats";
import { requireAdmin } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  MAX_CSV_BYTES,
  parseMarketStatsCsv,
  type AreaLevel,
  type CsvPropertyType,
  type FileError,
  type ImportGroup,
  type ImportWarning,
  type ParseResult,
  type ParsedMetrics,
  type RowError,
} from "@/lib/csv/marketStatsImport";

// Bulk upload of OFFICIAL figures (Align Step 3, Build A). Two steps:
// check (read the file, show a preview, write nothing) and import (read the
// SAME file again from scratch — the preview is never trusted — then save
// every group through upsertMarketStat as OFFICIAL_STAT). All-or-nothing: a
// single problem anywhere and nothing is saved. The file itself is never
// kept; only the validated figures are.

const HOUR = 60 * 60 * 1000;
const CHECK_LIMIT = { limit: 20, windowMs: HOUR };
const CONFIRM_LIMIT = { limit: 10, windowMs: HOUR };
const PREVIEW_GROUPS = 50;
const PREVIEW_PROBLEMS = 200;

export type ExistingFigure = {
  provenance: DataProvenance;
  confidence: number;
  isSample: boolean;
};

/** One preview row — plain JSON, safe to hand to the client. */
export type PreviewGroup = {
  level: AreaLevel;
  nameEn: string;
  nameAr: string | null;
  propertyType: CsvPropertyType | null;
  periodStart: string;
  metrics: ParsedMetrics;
  confidence: number;
  sourceUrl: string;
  existing: ExistingFigure | null;
};

export type ImportState =
  | null
  | { kind: "notAllowed" }
  | { kind: "serverError" }
  | { kind: "rateLimited"; minutes: number }
  | { kind: "refused"; fileErrors: FileError[]; warnings: ImportWarning[] }
  | {
      kind: "preview";
      /** figures = one per accepted row of the file */
      figures: number;
      /** figures whose place+type+month already has a row */
      replaceFigures: number;
      problems: number;
      rowErrors: RowError[]; // first PREVIEW_PROBLEMS only
      warnings: ImportWarning[];
      groups: PreviewGroup[]; // first PREVIEW_GROUPS only
      shownFigures: number;
    }
  | { kind: "done"; figures: number; replaced: number }
  | { kind: "partial"; saved: number; total: number };

type ReadResult =
  | { ok: true; parsed: ParseResult }
  | { ok: false; state: ImportState };

const refused = (code: FileError["code"]): ReadResult => ({
  ok: false,
  state: { kind: "refused", fileErrors: [{ code }], warnings: [] },
});

/** Size and type checks, UTF-8 decoding, places from the database, parse. */
async function readAndParse(formData: FormData): Promise<ReadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return refused("empty");
  // Size first: an oversized file is refused before a byte of it is read.
  if (file.size > MAX_CSV_BYTES) return refused("fileTooBig");
  const looksCsv =
    /\.csv$/i.test(file.name) ||
    file.type === "text/csv" ||
    file.type === "application/csv";
  if (!looksCsv) return refused("notCsv");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    return refused("notUtf8");
  }

  const [governorates, cities, neighborhoods] = await Promise.all([
    prisma.governorate.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true } }),
    prisma.city.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true } }),
    prisma.neighborhood.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true } }),
  ]);
  const parsed = parseMarketStatsCsv(text, {
    mode: "official",
    neighborhoodAllowed: formData.get("neighborhoodAllowed") === "on",
    places: { governorates, cities, neighborhoods },
  });
  if (parsed.fileErrors.length > 0) {
    return {
      ok: false,
      state: { kind: "refused", fileErrors: parsed.fileErrors, warnings: parsed.warnings },
    };
  }
  return { ok: true, parsed };
}

function groupKey(level: AreaLevel, id: string, type: string | null, month: string) {
  return `${level}:${id}|${type ?? ""}|${month.slice(0, 7)}`;
}

/** Which groups already have a row (real row preferred over a sample one). */
async function existingFigures(groups: ImportGroup[]): Promise<Map<string, ExistingFigure>> {
  const found = new Map<string, ExistingFigure>();
  if (groups.length === 0) return found;
  const ids = (level: AreaLevel) =>
    [...new Set(groups.filter((g) => g.scope.level === level).map((g) => g.scope.id))];
  const periods = [...new Set(groups.map((g) => new Date(`${g.periodStart}T00:00:00.000Z`)).map((d) => d.getTime()))].map(
    (t) => new Date(t),
  );
  const rows = await prisma.marketStat.findMany({
    where: {
      periodStart: { in: periods },
      OR: [
        { governorateId: { in: ids("governorate") }, cityId: null, neighborhoodId: null },
        { cityId: { in: ids("city") }, governorateId: null, neighborhoodId: null },
        { neighborhoodId: { in: ids("neighborhood") }, governorateId: null, cityId: null },
      ],
    },
    orderBy: { isSample: "desc" }, // sample first, so a real row overwrites it below
    select: {
      governorateId: true,
      cityId: true,
      neighborhoodId: true,
      propertyType: true,
      periodStart: true,
      provenance: true,
      confidence: true,
      isSample: true,
    },
  });
  for (const r of rows) {
    const [level, id] = r.neighborhoodId
      ? (["neighborhood", r.neighborhoodId] as const)
      : r.cityId
        ? (["city", r.cityId] as const)
        : (["governorate", r.governorateId!] as const);
    found.set(groupKey(level, id, r.propertyType, r.periodStart.toISOString()), {
      provenance: r.provenance,
      confidence: r.confidence,
      isSample: r.isSample,
    });
  }
  return found;
}

const keyOf = (g: ImportGroup) => groupKey(g.scope.level, g.scope.id, g.propertyType, g.periodStart);
const figureCount = (g: ImportGroup) => g.lines.length;

async function buildPreview(parsed: ParseResult): Promise<ImportState> {
  const existing = await existingFigures(parsed.groups);
  const shown = parsed.groups.slice(0, PREVIEW_GROUPS);
  return {
    kind: "preview",
    figures: parsed.counts.figures,
    replaceFigures: parsed.groups
      .filter((g) => existing.has(keyOf(g)))
      .reduce((n, g) => n + figureCount(g), 0),
    problems: parsed.rowErrors.length,
    rowErrors: parsed.rowErrors.slice(0, PREVIEW_PROBLEMS),
    warnings: parsed.warnings,
    shownFigures: shown.reduce((n, g) => n + figureCount(g), 0),
    groups: shown.map((g) => ({
      level: g.scope.level,
      nameEn: g.scope.nameEn,
      nameAr: g.scope.nameAr,
      propertyType: g.propertyType,
      periodStart: g.periodStart,
      metrics: g.metrics,
      confidence: g.confidence,
      sourceUrl: g.sourceUrl,
      existing: existing.get(keyOf(g)) ?? null,
    })),
  };
}

/** Step 1: read the file and show what WOULD be saved. Writes nothing. */
export async function checkMarketStatsImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await requireAdmin();
  if (!session) return { kind: "notAllowed" };

  const limit = checkRateLimit(`admin-import:user:${session.user.id}:check`, CHECK_LIMIT);
  if (!limit.allowed) return { kind: "rateLimited", minutes: Math.ceil(limit.retryAfter / 60) };

  try {
    const read = await readAndParse(formData);
    if (!read.ok) return read.state;
    return await buildPreview(read.parsed);
  } catch (err) {
    console.error("[admin-import] check failed", err);
    return { kind: "serverError" };
  }
}

/**
 * Step 2: read the same file again from scratch and, only if every row is
 * clean, save each group as an OFFICIAL_STAT figure (replacing any existing
 * row for that place + type + month — re-importing a file is safe).
 */
export async function confirmMarketStatsImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await requireAdmin();
  if (!session) return { kind: "notAllowed" };

  const limit = checkRateLimit(`admin-import:user:${session.user.id}:confirm`, CONFIRM_LIMIT);
  if (!limit.allowed) return { kind: "rateLimited", minutes: Math.ceil(limit.retryAfter / 60) };

  let parsed: ParseResult;
  try {
    const read = await readAndParse(formData);
    if (!read.ok) return read.state;
    parsed = read.parsed;
    // All-or-nothing: any problem → show the preview again, save nothing.
    if (parsed.rowErrors.length > 0 || parsed.groups.length === 0) {
      return await buildPreview(parsed);
    }
  } catch (err) {
    console.error("[admin-import] re-check failed", err);
    return { kind: "serverError" };
  }

  let savedGroups = 0;
  let savedFigures = 0;
  let replaced = 0;
  let failed = false;
  for (const g of parsed.groups) {
    try {
      const result = await upsertMarketStat({
        scope: { kind: g.scope.level, id: g.scope.id },
        propertyType: g.propertyType,
        periodStart: new Date(`${g.periodStart}T00:00:00.000Z`),
        metrics: g.metrics,
        provenance: "OFFICIAL_STAT",
        confidence: g.confidence,
        sourceNote: g.sourceNote || `Official figure imported from ${g.sourceUrl}`,
        sourceUrl: g.sourceUrl,
        onConflict: "replace",
      });
      savedGroups++;
      savedFigures += figureCount(g);
      if (result.updated) replaced += figureCount(g);
    } catch (err) {
      console.error("[admin-import] save failed part-way", err);
      failed = true;
      break;
    }
  }

  if (savedGroups > 0) {
    updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
    revalidatePath("/", "layout");
  }
  if (failed) {
    return { kind: "partial", saved: savedFigures, total: parsed.counts.figures };
  }
  return { kind: "done", figures: savedFigures, replaced };
}
