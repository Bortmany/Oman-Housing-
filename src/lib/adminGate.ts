// Route-group access gate — the code the Next 16 middleware (src/proxy.ts)
// uses to STOP a request to the (admin)/(agency) route groups before any
// Server Component renders or streams.
//
// Why this exists (the pentest finding it fixes): in the App Router a group
// layout and its child page render IN PARALLEL. The (admin) layout calling
// `redirect()` sets a 307, but each admin page's Server Component still runs
// its DB query and flushes the rendered admin data INTO that same 307 body —
// so `curl` (no cookie) got a 307→/login whose body still contained every
// agency's buyer PII. A layout redirect cannot protect data. The middleware
// gate here refuses the request outright (empty redirect body) before the
// page can render, and per-page `enforceAdminPage()` is the defense-in-depth.
//
// Pure + free of app/next imports on purpose, so it unit-tests directly under
// `tsx` (same split as clientIp.ts / anonId.ts — tsx does not resolve the
// `@/` path alias). The locale list mirrors src/i18n/routing.ts; keep the two
// in sync (there are only ever these two).

export type GateSegment = "admin" | "agency" | null;

export type GateDecision =
  | { action: "allow" }
  | { action: "redirect"; locale: string };

const LOCALES: readonly string[] = ["en", "ar"];
const DEFAULT_LOCALE = "en";

function isLocale(value: string | undefined): boolean {
  return value !== undefined && LOCALES.includes(value);
}

/**
 * Which protected route group a pathname belongs to, looking at the first
 * segment after an optional `/en` or `/ar` locale prefix. Returns null for
 * every public path. Handles both the locale-prefixed form the app uses
 * (`/en/admin/inquiries`) and the bare form the middleware may see before
 * next-intl adds the prefix (`/admin/inquiries`).
 */
export function protectedSegment(pathname: string): GateSegment {
  const parts = pathname.split("/").filter(Boolean);
  const idx = isLocale(parts[0]) ? 1 : 0;
  const seg = parts[idx];
  if (seg === "admin") return "admin";
  if (seg === "agency") return "agency";
  return null;
}

/** The locale to bounce an unauthorized visitor to, read off the path. */
export function localeFromPath(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  return isLocale(first) ? (first as string) : DEFAULT_LOCALE;
}

/**
 * Decide allow/redirect for a request to a protected group, given the role on
 * the caller's session token (or null when unauthenticated). Admin pages need
 * ADMIN; agency pages need AGENCY (matching each group's layout). Everything
 * else is allowed through untouched.
 */
export function gateDecision(
  pathname: string,
  role: string | null | undefined,
): GateDecision {
  const segment = protectedSegment(pathname);
  if (segment === null) return { action: "allow" };

  const needed = segment === "admin" ? "ADMIN" : "AGENCY";
  if (role === needed) return { action: "allow" };
  return { action: "redirect", locale: localeFromPath(pathname) };
}
