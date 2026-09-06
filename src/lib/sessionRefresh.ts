// Pure helpers for keeping the signed-in session's role fresh.
//
// The session is a signed JWT, so by default whatever role/agency a user had
// at sign-in sticks until they sign out — un-approving an agency or demoting
// an admin would not take effect for days. src/auth.ts re-reads the user from
// the database at most once per ROLE_REFRESH_MS (a timestamp in the token
// remembers when it last looked), so a change lands within minutes without a
// database hit on every request. The decision logic lives here, with no
// Prisma/Auth.js imports, so it can be unit tested (`npm test`).

/** How long a token may go before its role is re-read from the database. */
export const ROLE_REFRESH_MS = 5 * 60 * 1000;

/** The slice of the token these helpers care about. */
export type RoleSnapshot = {
  role?: string;
  tier?: string;
  agencyId?: string | null;
  agencyApproved?: boolean;
  /** Epoch ms of the last database re-read (unset = never). */
  roleCheckedAt?: number;
};

/** What the lightweight database query returns (null = user no longer exists). */
export type FreshUser = {
  role: string;
  tier: string;
  agencyId: string | null;
  agency: { isApproved: boolean } | null;
} | null;

/**
 * True when the token is due for a database re-read: never checked, checked
 * longer than `intervalMs` ago, or carrying a clock-skewed future timestamp.
 */
export function shouldRefreshRole(
  roleCheckedAt: number | undefined,
  now: number,
  intervalMs: number = ROLE_REFRESH_MS,
): boolean {
  if (typeof roleCheckedAt !== "number" || !Number.isFinite(roleCheckedAt)) {
    return true;
  }
  if (roleCheckedAt > now) return true; // future stamp — don't trust it
  return now - roleCheckedAt >= intervalMs;
}

/**
 * Copies the freshly-read role, tier, agency and approval flag onto the token
 * and stamps the check time. Returns null when the user no longer exists —
 * the caller must treat that as "sign this session out".
 */
export function applyFreshUser<T extends RoleSnapshot>(
  token: T,
  fresh: FreshUser,
  now: number,
): T | null {
  if (!fresh) return null;
  token.role = fresh.role;
  token.tier = fresh.tier;
  token.agencyId = fresh.agencyId;
  token.agencyApproved = fresh.agency?.isApproved ?? false;
  token.roleCheckedAt = now;
  return token;
}
