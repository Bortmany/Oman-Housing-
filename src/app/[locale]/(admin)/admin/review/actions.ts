"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

async function requireAdmin() {
  const session = await auth();
  return session?.user.role === "ADMIN" ? session : null;
}

async function backToReview() {
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/review", locale });
}

/** Publish a pending (agency-submitted) listing — makes it public. */
export async function approveListing(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.listing.update({
      where: { id },
      data: { status: "ACTIVE", publishedAt: new Date() },
    });
  }
  await backToReview();
}

export async function rejectListing(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.listing.update({ where: { id }, data: { status: "REJECTED" } });
  await backToReview();
}

/** Mark a user-submitted property verified — stamps who/when, same idiom as
 *  the properties admin form's provenance === VERIFIED path. */
export async function verifyProperty(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.property.update({
      where: { id },
      data: {
        provenance: "VERIFIED",
        verifiedById: session.user.id,
        verifiedAt: new Date(),
      },
    });
  }
  await backToReview();
}

export async function verifyStat(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.marketStat.update({
      where: { id },
      data: {
        provenance: "VERIFIED",
        verifiedById: session.user.id,
        verifiedAt: new Date(),
      },
    });
  }
  await backToReview();
}
