// Ads: the database half. No "server-only" so the database-backed test can
// load it; the admin actions and pages are the only callers that matter.
// Rate limits are applied by the callers (actions, click route, serve.ts).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasOverlap, omanDay, pickCampaign, type AdSlotName, type ParsedCampaign } from "./rules";

// ---------- Reading ----------

/** The one live campaign for a slot (and area), or null. */
export async function findLiveCampaign(slot: AdSlotName, neighborhoodId: string | null | undefined, now = new Date()) {
  const candidates = await prisma.adCampaign.findMany({
    where: {
      slot,
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
      ...(neighborhoodId !== undefined && neighborhoodId !== null ? { neighborhoodId } : {}),
    },
    take: 5,
  });
  return pickCampaign(candidates, slot, neighborhoodId, now);
}

// ---------- Counting (one atomic statement; never read-then-write) ----------

async function bump(campaignId: string, column: "views" | "clicks", now: Date): Promise<void> {
  const day = omanDay(now);
  const id = `ads${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  if (column === "views") {
    await prisma.$executeRaw`
      INSERT INTO "AdDailyStat" ("id", "campaignId", "day", "views", "clicks")
      VALUES (${id}, ${campaignId}, ${day}, 1, 0)
      ON CONFLICT ("campaignId", "day") DO UPDATE SET "views" = "AdDailyStat"."views" + 1`;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "AdDailyStat" ("id", "campaignId", "day", "views", "clicks")
      VALUES (${id}, ${campaignId}, ${day}, 0, 1)
      ON CONFLICT ("campaignId", "day") DO UPDATE SET "clicks" = "AdDailyStat"."clicks" + 1`;
  }
}

export const recordAdView = (campaignId: string, now = new Date()) => bump(campaignId, "views", now);
export const recordAdClick = (campaignId: string, now = new Date()) => bump(campaignId, "clicks", now);

// ---------- Writing (admin) ----------

export type SaveResult = { ok: true; id: string } | { ok: false; error: "overlap" | "neighborhood" | "notFound" };

async function overlapWith(c: ParsedCampaign, ignoreId?: string): Promise<boolean> {
  const others = await prisma.adCampaign.findMany({
    where: {
      slot: c.slot,
      isActive: true,
      neighborhoodId: c.neighborhoodId,
      startsAt: { lt: c.endsAt },
      endsAt: { gt: c.startsAt },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true, slot: true, neighborhoodId: true, startsAt: true, endsAt: true, isActive: true },
  });
  return hasOverlap({ ...c, id: ignoreId }, others);
}

/** Checks the rules that need the database (area exists, no overlap). */
export async function checkCampaignRules(c: ParsedCampaign, ignoreId?: string): Promise<"ok" | "overlap" | "neighborhood"> {
  if (c.neighborhoodId) {
    const hood = await prisma.neighborhood.findUnique({ where: { id: c.neighborhoodId }, select: { id: true } });
    if (!hood) return "neighborhood";
  }
  return (await overlapWith(c, ignoreId)) ? "overlap" : "ok";
}

export async function createCampaign(
  id: string,
  c: ParsedCampaign,
  images: { imageEnPath: string; imageArPath: string | null },
  isActive = true,
): Promise<SaveResult> {
  const rule = await checkCampaignRules(c);
  if (rule !== "ok") return { ok: false, error: rule };
  await prisma.adCampaign.create({
    data: {
      id,
      advertiser: c.advertiser,
      slot: c.slot,
      neighborhoodId: c.neighborhoodId,
      linkUrl: c.linkUrl,
      altEn: c.altEn,
      altAr: c.altAr,
      imageEnPath: images.imageEnPath,
      imageArPath: images.imageArPath,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      isActive,
      agreedPrice: c.agreedPrice === null ? null : new Prisma.Decimal(c.agreedPrice),
    },
  });
  return { ok: true, id };
}

export async function updateCampaign(
  id: string,
  c: ParsedCampaign,
  images: { imageEnPath?: string; imageArPath?: string },
  isActive: boolean,
): Promise<SaveResult> {
  const existing = await prisma.adCampaign.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "notFound" };
  if (isActive) {
    const rule = await checkCampaignRules(c, id);
    if (rule !== "ok") return { ok: false, error: rule };
  } else if (c.neighborhoodId) {
    const hood = await prisma.neighborhood.findUnique({ where: { id: c.neighborhoodId }, select: { id: true } });
    if (!hood) return { ok: false, error: "neighborhood" };
  }
  await prisma.adCampaign.update({
    where: { id },
    data: {
      advertiser: c.advertiser,
      slot: c.slot,
      neighborhoodId: c.neighborhoodId,
      linkUrl: c.linkUrl,
      altEn: c.altEn,
      altAr: c.altAr,
      ...images,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      isActive,
      agreedPrice: c.agreedPrice === null ? null : new Prisma.Decimal(c.agreedPrice),
    },
  });
  return { ok: true, id };
}

/** Pause or resume. Resuming re-checks that nobody else now holds the slot. */
export async function setCampaignActive(id: string, active: boolean): Promise<SaveResult> {
  const row = await prisma.adCampaign.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "notFound" };
  if (active) {
    const rule = await checkCampaignRules(
      {
        advertiser: row.advertiser,
        slot: row.slot,
        neighborhoodId: row.neighborhoodId,
        linkUrl: row.linkUrl,
        altEn: row.altEn,
        altAr: row.altAr,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        agreedPrice: null,
      },
      id,
    );
    if (rule !== "ok") return { ok: false, error: rule };
  }
  await prisma.adCampaign.update({ where: { id }, data: { isActive: active } });
  return { ok: true, id };
}

// ---------- Reporting ----------

export async function campaignTotals(ids: string[]): Promise<Map<string, { views: number; clicks: number }>> {
  const out = new Map<string, { views: number; clicks: number }>();
  if (ids.length === 0) return out;
  const rows = await prisma.adDailyStat.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: ids } },
    _sum: { views: true, clicks: true },
  });
  for (const r of rows) out.set(r.campaignId, { views: r._sum.views ?? 0, clicks: r._sum.clicks ?? 0 });
  return out;
}

export async function countLiveCampaigns(now = new Date()): Promise<number> {
  return prisma.adCampaign.count({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } } });
}
