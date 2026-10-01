"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { redirect } from "@/i18n/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";
import { REVIEW_NOTE_MAX } from "@/lib/listings/rules";
import { deleteStoredFile } from "@/lib/storage";

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

/** Publish a pending (owner- or agency-submitted) listing — makes it public.
 *  Only a listing that is really waiting for review can be published; an edit
 *  of an already-published listing keeps its first published date. */
export async function approveListing(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    const pending = await prisma.listing.findFirst({
      where: { id, status: "PENDING_REVIEW" },
      select: { publishedAt: true },
    });
    if (pending) {
      await prisma.listing.update({
        where: { id },
        data: { status: "ACTIVE", publishedAt: pending.publishedAt ?? new Date(), reviewNote: null },
      });
      // A real live listing hides sample homes on the cached market pages.
      updateTag(MARKET_DATA_CACHE_TAG);
    }
  }
  await backToReview();
}

/** Reject a pending listing, with an optional short note the seller will see. */
export async function rejectListing(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    const raw = formData.get("note");
    const note = typeof raw === "string" ? raw.trim().slice(0, REVIEW_NOTE_MAX) : "";
    const res = await prisma.listing.updateMany({
      where: { id, status: "PENDING_REVIEW" },
      data: { status: "REJECTED", reviewNote: note || null },
    });
    if (res.count > 0) updateTag(MARKET_DATA_CACHE_TAG); // live listings decide which sample homes show
  }
  await backToReview();
}

/** Remove ONE photo from a listing that is waiting for review (the admin stays on the queue). */
export async function removeReviewPhoto(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const id = readId(formData);
  if (id) {
    const image = await prisma.propertyImage.findFirst({
      where: { id, property: { listings: { some: { status: "PENDING_REVIEW" } } } },
      select: { id: true, propertyId: true, storagePath: true },
    });
    if (image) {
      await prisma.propertyImage.delete({ where: { id: image.id } });
      await deleteStoredFile(image.storagePath);
      // Keep the cover rule: the first remaining photo is the cover.
      const rest = await prisma.propertyImage.findMany({
        where: { propertyId: image.propertyId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      await prisma.$transaction(
        rest.map((r, i) =>
          prisma.propertyImage.update({ where: { id: r.id }, data: { sortOrder: i, isPrimary: i === 0 } }),
        ),
      );
      updateTag(MARKET_DATA_CACHE_TAG);
    }
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
    // Never stamp invented sample data VERIFIED (house rule 1), and never a
    // private owner's home (owner listings are never VERIFIED).
    await prisma.property.updateMany({
      where: { id, isSample: false, listings: { none: { agencyId: null } } },
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
