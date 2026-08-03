/**
 * Only allow relative in-app paths for post-action redirects (login
 * `callbackUrl`, "continue to this listing after signing in", etc.) — never
 * an absolute URL or a same-string-different-host trick (open-redirect
 * guard). Falls back to a safe default when the value doesn't look like an
 * in-app path.
 *
 * Browsers silently drop tab/newline/carriage-return characters and treat a
 * backslash the same as a forward slash when parsing a URL. That means
 * `/\evil.com` (or `/\t/evil.com`) is NAVIGATED as `//evil.com` —
 * protocol-relative, i.e. a different host — even though the raw string
 * doesn't start with `//`. Normalize the same way BEFORE the same-origin
 * check, or that class of value sails through.
 */
export function safePath(raw: unknown, fallback: string): string {
  const s = String(raw ?? "")
    .replace(/[\t\r\n]/g, "")
    .replace(/\\/g, "/");

  if (!s.startsWith("/") || s.startsWith("//")) return fallback;
  return s;
}
