"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Session } from "next-auth";
import type { DataProvenance } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyById } from "@/lib/db/agencies";
import { MARKET_DATA_CACHE_TAG, upsertMarketStat } from "@/lib/db/market-stats";
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
import {
  MAX_UNAPPROVED_PER_AGENCY,
  agencyNoteMatch,
  agencyWriteFor,
  queueHasRoom,
} from "@/lib/csv/agencyUpload";

// Agency market-data upload (Align Step 3, Build B). Two steps like the admin
// bulk upload: check (preview, writes nothing) then confirm (the whole file is
// checked again, then each figure is saved as USER_SUBMITTED, confidence 0.5,
// never replacing an existing figure). Nothing an agency sends is public until
// the owner approves it (src/lib/statVisibility.ts). The pure rules live in
// src/lib/csv/agencyUpload.ts.

const HOUR = 60 * 60 * 1000;
const CHECK_LIMIT = { limit: 10, windowMs: HOUR };
const CONFIRM_LIMIT = { limit: 5, windowMs: HOUR };
const PREVIEW_GROUPS = 50;
const PREVIEW_PROBLEMS = 200;

/** Guard: a signed-in AGENCY user whose agency is linked. Own copy of the idiom
 *  in (agency)/agency/actions.ts (that one is not exported). Approval is read
 *  fresh from the database, never from the session. */
async function requireAgency(): Promise<
  | { ok: true; session: Session; agencyId: string; agencyNameEn: string }
  | { ok: false; reason: "notAllowed" | "notApproved" }
> {
  const session = await auth();
  if (session?.user.role !== "AGENCY" || !session.user.agencyId) {
    return { ok: false, reason: "notAllowed" };
  }
  const agency = await agencyById(session.user.agencyId);
  if (!agency) return { ok: false, reason: "notAllowed" };
  if (!agency.isApproved) return { ok: false, reason: "notApproved" };
  return { ok: true, session, agencyId: agency.id, agencyNameEn: agency.nameEn };
}

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
  /** A figure already exists, so this row will be skipped. */
  existing: ExistingFigure | null;
};

export type UploadState =
  | null
  | { kind: "notAllowed" }
  | { kind: "notApproved" }
  | { kind: "serverError" }
  | { kind: "rateLimited"; minutes: number }
  | { kind: "queueFull"; waiting: number }
  | { kind: "refused"; fileErrors: FileError[]; warnings: ImportWarning[] }
  | {
      kind: "preview";
      /** one per accepted row of the file */
      figures: number;
      /** figures that will be sent (new ones) */
      readyFigures: number;
      /** figures skipped because a figure already exists */
      skippedFigures: number;
      problems: number;
      rowErrors: RowError[];
      warnings: ImportWarning[];
      groups: PreviewGroup[];
      shownFigures: number;
    }
  | { kind: "done"; figures: number; skipped: number }
  | { kind: "partial"; saved: number; total: number };

type ReadResult = { ok: true; parsed: ParseResult } | { ok: false; state: UploadState };

const refused = (code: FileError["code"]): ReadResult => ({
  ok: false,
  state: { kind: "refused", fileErrors: [{ code }], warnings: [] },
});

async function readAndParse(formData: FormData): Promise<ReadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return refused("empty");
  if (file.size > MAX_CSV_BYTES) return refused("fileTooBig"); // before reading a byte
  const looksCsv =
    /\.csv$/i.test(file.name) || file.type === "text/csv" || file.type === "application/csv";
  if (!looksCsv) return refused("notCsv");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return refused("notUtf8");
  }

  const [governorates, cities, neighborhoods] = await Promise.all([
    prisma.governorate.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true } }),
    prisma.city.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true } }),
    prisma.neighborhood.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true } }),
  ]);
  // Agency mode: at most 100 rows, neighbourhood rows allowed, confidence fixed.
  const parsed = parseMarketStatsCsv(text, {
    mode: "agency",
    neighborhoodAllowed: true,
    places: { governorates, cities, neighborhoods },
  });
  if (parsed.fileErrors.length > 0) {
    return { ok: false, state: { kind: "refused", fileErrors: parsed.fileErrors, warnings: parsed.warnings } };
  }
  return { ok: true, parsed };
}

function groupKey(level: AreaLevel, id: string, type: string | null, month: string) {
  return `${level}:${id}|${type ?? ""}|${month.slice(0, 7)}`;
}
const keyOf = (g: ImportGroup) => groupKey(g.scope.level, g.scope.id, g.propertyType, g.periodStart);
const figureCount = (g: ImportGroup) => g.lines.length;

/** Which groups already have a row (they will be skipped). */
async function existingFigures(groups: ImportGroup[]): Promise<Map<string, ExistingFigure>> {
  const found = new Map<string, ExistingFigure>();
  if (groups.length === 0) return found;
  const ids = (level: AreaLevel) =>
    [...new Set(groups.filter((g) => g.scope.level === level).map((g) => g.scope.id))];
  const periods = [
    ...new Set(groups.map((g) => new Date(`${g.periodStart}T00:00:00.000Z`).getTime())),
  ].map((t) => new Date(t));
  const rows = await prisma.marketStat.findMany({
    where: {
      periodStart: { in: periods },
      OR: [
        { governorateId: { in: ids("governorate") }, cityId: null, neighborhoodId: null },
        { cityId: { in: ids("city") }, governorateId: null, neighborhoodId: null },
        { neighborhoodId: { in: ids("neighborhood") }, governorateId: null, cityId: null },
      ],
    },
    orderBy: { isSample: "desc" },
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

/** This agency's figures still waiting for the owner (recognised by the agency
 *  name in the source note — MarketStat has no agency column). */
async function waitingCount(agencyNameEn: string): Promise<number> {
  const m = agencyNoteMatch(agencyNameEn);
  return prisma.marketStat.count({
    where: {
      provenance: "USER_SUBMITTED",
      verifiedAt: null,
      OR: [{ sourceNote: m.exact }, { sourceNote: { startsWith: m.startsWith } }],
    },
  });
}

async function buildPreview(parsed: ParseResult): Promise<UploadState> {
  const existing = await existingFigures(parsed.groups);
  const shown = parsed.groups.slice(0, PREVIEW_GROUPS);
  const skipped = parsed.groups.filter((g) => existing.has(keyOf(g)));
  const skippedFigures = skipped.reduce((n, g) => n + figureCount(g), 0);
  return {
    kind: "preview",
    figures: parsed.counts.figures,
    readyFigures: parsed.counts.figures - skippedFigures,
    skippedFigures,
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

/** Step 1: read the file and show what WOULD be sent. Writes nothing. */
export async function checkAgencyData(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const who = await requireAgency();
  if (!who.ok) return { kind: who.reason };

  const limit = checkRateLimit(`agency-data:user:${who.session.user.id}:check`, CHECK_LIMIT);
  if (!limit.allowed) return { kind: "rateLimited", minutes: Math.ceil(limit.retryAfter / 60) };

  try {
    const waiting = await waitingCount(who.agencyNameEn);
    if (waiting >= MAX_UNAPPROVED_PER_AGENCY) return { kind: "queueFull", waiting };
    const read = await readAndParse(formData);
    if (!read.ok) return read.state;
    const preview = await buildPreview(read.parsed);
    if (
      preview?.kind === "preview" &&
      preview.problems === 0 &&
      !queueHasRoom(waiting, preview.readyFigures)
    ) {
      return { kind: "queueFull", waiting };
    }
    return preview;
  } catch (err) {
    console.error("[agency-data] check failed", err);
    return { kind: "serverError" };
  }
}

/**
 * Step 2: read the same file again from scratch and, only if every row is
 * clean, save each NEW figure as USER_SUBMITTED. A place + type + month that
 * already has a figure is skipped, never replaced.
 */
export async function confirmAgencyData(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const who = await requireAgency();
  if (!who.ok) return { kind: who.reason };

  const limit = checkRateLimit(`agency-data:user:${who.session.user.id}:confirm`, CONFIRM_LIMIT);
  if (!limit.allowed) return { kind: "rateLimited", minutes: Math.ceil(limit.retryAfter / 60) };

  let parsed: ParseResult;
  try {
    const waiting = await waitingCount(who.agencyNameEn);
    if (waiting >= MAX_UNAPPROVED_PER_AGENCY) return { kind: "queueFull", waiting };
    const read = await readAndParse(formData);
    if (!read.ok) return read.state;
    parsed = read.parsed;
    if (parsed.rowErrors.length > 0 || parsed.groups.length === 0) {
      return await buildPreview(parsed);
    }
    if (!queueHasRoom(waiting, parsed.groups.length)) return { kind: "queueFull", waiting };
  } catch (err) {
    console.error("[agency-data] re-check failed", err);
    return { kind: "serverError" };
  }

  let savedFigures = 0;
  let skippedFigures = 0;
  let failed = false;
  for (const g of parsed.groups) {
    try {
      const result = await upsertMarketStat({
        scope: { kind: g.scope.level, id: g.scope.id },
        propertyType: g.propertyType,
        periodStart: new Date(`${g.periodStart}T00:00:00.000Z`),
        metrics: g.metrics,
        ...agencyWriteFor(g, who.agencyNameEn),
      });
      if (result.skipped) skippedFigures += figureCount(g);
      else savedFigures += figureCount(g);
    } catch (err) {
      console.error("[agency-data] save failed part-way", err);
      failed = true;
      break;
    }
  }

  if (savedFigures > 0) {
    // Unapproved rows are hidden publicly, but keep cached pages honest anyway.
    updateTag(MARKET_DATA_CACHE_TAG);
    revalidatePath("/", "layout");
  }
  if (failed) return { kind: "partial", saved: savedFigures, total: parsed.counts.figures };
  return { kind: "done", figures: savedFigures, skipped: skippedFigures };
}
