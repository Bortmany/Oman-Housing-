import "server-only";
import type { Session } from "next-auth";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

/**
 * Guard for admin server actions (house rule 7: role checks in every admin
 * action, not just the route-group layout). Returns the session for a
 * signed-in ADMIN, or null so the caller can bail out exactly as before.
 */
export async function requireAdmin(): Promise<Session | null> {
  const session = await auth();
  return session?.user.role === "ADMIN" ? session : null;
}

/**
 * Guard for admin PAGES — call this at the very top of every (admin) page,
 * before any DB query. The (admin) layout's redirect() does NOT protect a
 * page's data: layout and page render in parallel, so the page's query still
 * runs and streams into the redirect body (the pentest leak). Calling this
 * FIRST makes the page itself redirect (which throws) before it ever fetches
 * data, so there is nothing to leak. The middleware gate (src/proxy.ts) is the
 * first line of defense; this is defense-in-depth for the same finding.
 */
export async function enforceAdminPage(): Promise<Session> {
  const session = await auth();
  if (session?.user.role === "ADMIN") return session;
  // Not an admin: redirect() throws internally, so nothing below runs and the
  // page never reaches its DB query. The throw is unreachable but satisfies
  // the non-null return type.
  redirect({ href: "/login", locale: await getLocale() });
  throw new Error("unreachable");
}
