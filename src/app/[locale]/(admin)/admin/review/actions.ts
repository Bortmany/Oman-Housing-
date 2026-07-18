"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { redirect } from "@/i18n/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";

/** Per-admin cap on mutations — a light guard against runaway loops/scripts. */
function adminAllowed(userId: string): boolean {
  return checkRateLimit(`admin:user:${userId}`, {
    limit: 120,
    windowMs: 60_000,
  }).allowed;
}

const idSchema = z.object({ id: z.string().trim().min(1).max(64) });

/** Read + validate the `id` field, returning it only when valid. */
function readId(formData: FormData): string | null {
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  return parsed.success ? parsed.data.id : null;
}

async function backToReview() {
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/review", locale });
}

/** Publish a pending (agency-submitted) listing — makes it public. */
export async function approveListing(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    await prisma.listing.update({
      where: { id },
      data: { status: "ACTIVE", publishedAt: new Date() },
    });
  }
  await backToReview();
}

export async function rejectListing(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) await prisma.listing.update({ where: { id }, data: { status: "REJECTED" } });
  await backToReview();
}

/** Mark a user-submitted property verified — stamps who/when, same idiom as
 *  the properties admin form's provenance === VERIFIED path. */
export async function verifyProperty(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    await prisma.property.update({
      where: { id },
      data: {
        provenance: "VERIFIED",
        verifiedById: session.user.id,
        verifiedAt: new Date(),
      },
    });
    updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
  }
  await backToReview();
}

export async function verifyStat(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    await prisma.marketStat.update({
      where: { id },
      data: {
        provenance: "VERIFIED",
        verifiedById: session.user.id,
        verifiedAt: new Date(),
      },
    });
    updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
  }
  await backToReview();
}
