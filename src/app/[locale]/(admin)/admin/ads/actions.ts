"use server";

// Admin ad desk: create, edit, pause/resume. Every action re-checks the ADMIN
// role itself (house rule 7) and shares the per-admin limiter (120/min); each
// image saved also counts against 30 uploads/hour. Images are checked by their
// own bytes and capped at 2 MB (src/lib/storage.ts). There is no delete.

import crypto from "node:crypto";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";
import { deleteStoredFile, saveAdImage } from "@/lib/storage";
import { createCampaign, setCampaignActive, updateCampaign } from "@/lib/ads/core";
import { parseCampaignInput, type CampaignInput } from "@/lib/ads/rules";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AdFormState = {
  error: string | null;
  values: Record<string, string> | null;
};

const FIELDS = ["advertiser", "slot", "neighborhoodId", "linkUrl", "altEn", "altAr", "startsAt", "endsAt", "agreedPrice"] as const;

const text = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function readInput(fd: FormData): CampaignInput {
  return {
    advertiser: text(fd.get("advertiser"), 200),
    slot: text(fd.get("slot"), 40),
    neighborhoodId: text(fd.get("neighborhoodId"), 64),
    linkUrl: text(fd.get("linkUrl"), 600),
    altEn: text(fd.get("altEn"), 300),
    altAr: text(fd.get("altAr"), 300),
    startsAt: text(fd.get("startsAt"), 20),
    endsAt: text(fd.get("endsAt"), 20),
    agreedPrice: text(fd.get("agreedPrice"), 20),
  };
}

function formState(error: string, input: CampaignInput): AdFormState {
  const values: Record<string, string> = {};
  for (const f of FIELDS) values[f] = input[f];
  return { error, values };
}

async function gate() {
  const session = await requireAdmin();
  if (!session) return null;
  const limit = checkRateLimit(`admin:user:${session.user.id}`, { limit: 120, windowMs: 60_000 });
  return { session, tooMany: !limit.allowed };
}

async function done(query: string): Promise<never> {
  revalidatePath("/", "layout"); // ads are on the home, market and property pages
  redirect({ href: `/admin/ads?${query}`, locale: await getLocale() });
  throw new Error("unreachable");
}

const fileOf = (fd: FormData, name: string): File | null => {
  const v = fd.get(name);
  return v instanceof File && v.size > 0 ? v : null;
};

/** Save the given pictures; on any failure remove the ones already saved. */
async function saveImages(
  userId: string,
  campaignId: string,
  files: { en: File | null; ar: File | null },
): Promise<{ ok: true; en?: string; ar?: string } | { ok: false; error: "image" | "rateLimited" }> {
  const saved: string[] = [];
  const out: { en?: string; ar?: string } = {};
  for (const key of ["en", "ar"] as const) {
    const file = files[key];
    if (!file) continue;
    if (!checkRateLimit(`ads:upload:user:${userId}`, { limit: 30, windowMs: 3600_000 }).allowed) {
      await Promise.all(saved.map(deleteStoredFile));
      return { ok: false, error: "rateLimited" };
    }
    const result = await saveAdImage(campaignId, file);
    if ("error" in result) {
      await Promise.all(saved.map(deleteStoredFile));
      return { ok: false, error: "image" };
    }
    saved.push(result.path);
    out[key] = result.path;
  }
  return { ok: true, ...out };
}

export async function createAdAction(_prev: AdFormState, fd: FormData): Promise<AdFormState> {
  const input = readInput(fd);
  const g = await gate();
  if (!g) return formState("failed", input);
  if (g.tooMany) return formState("rateLimited", input);

  const parsed = parseCampaignInput(input);
  if (!parsed.ok) return formState(parsed.error, input);
  const en = fileOf(fd, "imageEn");
  if (!en) return formState("image", input);

  const id = crypto.randomUUID();
  const images = await saveImages(g.session.user.id, id, { en, ar: fileOf(fd, "imageAr") });
  if (!images.ok) return formState(images.error, input);

  try {
    const result = await createCampaign(id, parsed.value, {
      imageEnPath: images.en!,
      imageArPath: images.ar ?? null,
    });
    if (!result.ok) {
      await Promise.all([images.en, images.ar].filter((p): p is string => !!p).map(deleteStoredFile));
      return formState(result.error, input);
    }
  } catch (err) {
    logger.error("ads.create.failed", err);
    await Promise.all([images.en, images.ar].filter((p): p is string => !!p).map(deleteStoredFile));
    return formState("failed", input);
  }
  return done("done=saved");
}

export async function updateAdAction(_prev: AdFormState, fd: FormData): Promise<AdFormState> {
  const input = readInput(fd);
  const g = await gate();
  if (!g) return formState("failed", input);
  if (g.tooMany) return formState("rateLimited", input);

  const id = text(fd.get("id"), 64);
  const existing = await prisma.adCampaign.findUnique({
    where: { id },
    select: { imageEnPath: true, imageArPath: true, isActive: true },
  });
  if (!existing) return formState("failed", input);

  const parsed = parseCampaignInput(input);
  if (!parsed.ok) return formState(parsed.error, input);

  const images = await saveImages(g.session.user.id, id, { en: fileOf(fd, "imageEn"), ar: fileOf(fd, "imageAr") });
  if (!images.ok) return formState(images.error, input);
  const newPaths = [images.en, images.ar].filter((p): p is string => !!p);

  try {
    const result = await updateCampaign(
      id,
      parsed.value,
      { ...(images.en ? { imageEnPath: images.en } : {}), ...(images.ar ? { imageArPath: images.ar } : {}) },
      existing.isActive,
    );
    if (!result.ok) {
      await Promise.all(newPaths.map(deleteStoredFile));
      return formState(result.error, input);
    }
  } catch (err) {
    logger.error("ads.update.failed", err, { campaignId: id });
    await Promise.all(newPaths.map(deleteStoredFile));
    return formState("failed", input);
  }
  // The replaced pictures are no longer used.
  if (images.en) await deleteStoredFile(existing.imageEnPath);
  if (images.ar && existing.imageArPath) await deleteStoredFile(existing.imageArPath);
  return done("done=saved");
}

export async function toggleAdAction(fd: FormData): Promise<void> {
  const g = await gate();
  if (!g) return done("error=failed");
  if (g.tooMany) return done("error=rateLimited");
  const id = text(fd.get("id"), 64);
  const resume = text(fd.get("to"), 10) === "resume";
  let query: string;
  try {
    const result = await setCampaignActive(id, resume);
    query = result.ok ? `done=${resume ? "resumed" : "paused"}` : `error=${result.error === "overlap" ? "overlap" : "failed"}`;
  } catch (err) {
    logger.error("ads.toggle.failed", err, { campaignId: id });
    query = "error=failed";
  }
  return done(query);
}
