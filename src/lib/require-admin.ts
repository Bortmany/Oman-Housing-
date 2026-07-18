import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";

/**
 * Guard for admin server actions (house rule 7: role checks in every admin
 * action, not just the route-group layout). Returns the session for a
 * signed-in ADMIN, or null so the caller can bail out exactly as before.
 */
export async function requireAdmin(): Promise<Session | null> {
  const session = await auth();
  return session?.user.role === "ADMIN" ? session : null;
}
