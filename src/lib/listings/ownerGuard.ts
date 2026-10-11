import "server-only";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import type { Actor } from "./rules";

/**
 * Guard for the private-owner PAGES — the very first line of every page under
 * /account/listings, before any query (a layout redirect does not stop a
 * page's data query; see require-admin.ts for the story). Signed-out visitors
 * go to sign-in, agencies to their workspace, admins to the admin desk.
 * An owner is any signed-in USER with no agency.
 */
export async function enforceOwnerPage(): Promise<Actor> {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  } else if (session.user.role === "ADMIN") {
    redirect({ href: "/admin", locale });
  } else if (session.user.role === "AGENCY" || session.user.agencyId) {
    redirect({ href: "/agency", locale });
  } else {
    return { userId: session.user.id, agencyId: null };
  }
  throw new Error("unreachable"); // redirect() throws; keeps the return type honest
}

/** Guard for owner server actions: the actor, or null (every action re-checks itself). */
export async function requireOwner(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "USER" || session.user.agencyId) return null;
  return { userId: session.user.id, agencyId: null };
}

/** The owner's saved phone (for the verified-phone gate and the tick-box wording). */
export async function ownerPhoneRow(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerifiedAt: true },
  });
}
