import "server-only";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import type { Actor } from "./rules";

/**
 * Guard for the agency listing PAGES — the first line of every page under
 * /agency/listings, before any query. Only a signed-in AGENCY user linked to
 * an agency gets an actor; everyone else is sent away. (An unapproved agency
 * may still add listings — the dashboard says so — and nothing it posts is
 * public until the owner approves it.)
 */
export async function enforceAgencyPage(): Promise<Actor> {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  } else if (session.user.role === "ADMIN") {
    redirect({ href: "/admin", locale });
  } else if (session.user.role !== "AGENCY" || !session.user.agencyId) {
    redirect({ href: "/account", locale });
  } else {
    return { userId: session.user.id, agencyId: session.user.agencyId };
  }
  throw new Error("unreachable"); // redirect() throws; keeps the return type honest
}

/** Guard for agency server actions: the actor, or null (every action re-checks itself). */
export async function requireAgencyActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "AGENCY" || !session.user.agencyId) return null;
  // The session can be a few minutes old: confirm the agency link is still real.
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, agencyId: true },
  });
  if (!row || row.role !== "AGENCY" || row.agencyId !== session.user.agencyId) return null;
  return { userId: session.user.id, agencyId: session.user.agencyId };
}
