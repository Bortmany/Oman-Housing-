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
    // A real live listing hides sample homes on the cached market pages.
    updateTag(MARKET_DATA_CACHE_TAG);
  }
  await backToReview();
}

export async function rejectListing(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    await prisma.listing.update({ where: { id }, data: { status: "REJECTED" } });
    updateTag(MARKET_DATA_CACHE_TAG); // live listings decide which sample homes show
  }
  await backToReview();
}

/** Mark a user-submitted property verified — stamps who/when, same idiom as
 *  the properties admin form's provenance === VERIFIED path. */
export async function verifyProperty(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    // Never stamp invented sample data VERIFIED (house rule 1).
    await prisma.property.updateMany({
      where: { id, isSample: false },
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

/** Reject a user-submitted market figure: deletes the row. Only rows that are
 *  still USER_SUBMITTED and unverified can go — never an official, verified,
 *  or already-approved figure. */
export async function rejectStat(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    await prisma.marketStat.deleteMany({
      where: { id, provenance: "USER_SUBMITTED", verifiedAt: null },
    });
    updateTag(MARKET_DATA_CACHE_TAG);
  }
  await backToReview();
}

export async function verifyStat(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    // Never stamp invented sample data VERIFIED (house rule 1), and only a
    // still-unverified user submission can be approved — never an official
    // or listing-derived row, even on a forged request.
    await prisma.marketStat.updateMany({
      where: {
        id,
        isSample: false,
        provenance: "USER_SUBMITTED",
        verifiedAt: null,
      },
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
