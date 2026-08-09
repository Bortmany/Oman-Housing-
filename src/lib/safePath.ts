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

/**
 * Turn any post-login redirect target (the `callbackUrl` query param OR the
 * value stored in the `authjs.callback-url` cookie) into a SAFE, well-formed
 * absolute URL, and NEVER throw on a malformed value.
 *
 * Two things a bad value must not be able to do:
 *  1. Open-redirect: send the visitor to another host after login.
 *  2. Crash the request: a malformed string (no scheme, stray spaces, etc.)
 *     fed to `new URL(...)` without a base throws "Invalid URL", and that
 *     value can arrive from a poisoned `authjs.callback-url` cookie on EVERY
 *     page render — so a bad cookie must be treated as absent, not fatal.
 *
 * Rules:
 *  - A same-origin in-app path ("/properties/abc") → returned as `baseUrl` +
 *    that path (normalized by safePath, which also blocks the `//host` and
 *    backslash open-redirect tricks).
 *  - A genuine absolute URL on OUR OWN origin → kept, but returned as its
 *    NORMALIZED `.href` (never the raw input — see below). We parse it
 *    WITHOUT a base on purpose: with a base, a junk string resolves against
 *    baseUrl and would falsely look same-origin. Without a base, anything
 *    that isn't a real absolute URL throws and we fall back safely.
 *  - Anything else (foreign host, malformed, empty) → `baseUrl`.
 *
 * Because this always returns a valid absolute URL, Auth.js never stores a
 * malformed value back into the callback-url cookie, and a already-poisoned
 * cookie self-heals to `baseUrl` on the next request instead of 500-ing.
 *
 * Why `.href` and never the raw string: `new URL(s).origin` Unicode-
 * normalizes the host before comparing (e.g. a fullwidth/homoglyph "o"
 * collapses to a plain ASCII "o" under the URL parser's IDNA mapping), so a
 * homoglyph host can pass the `origin === baseUrl` check while the RAW
 * string `s` still contains the original non-ASCII character — in the host,
 * or anywhere else in the URL (an emoji in the path also passes, since only
 * the origin is compared). Handing that raw, non-Latin1 string to Auth.js
 * means it eventually lands in a cookie/header value, and Node's Headers
 * implementation throws a TypeError on any character above U+00FF, which
 * Auth.js turns into a generic error=Configuration 500. `.href` is always
 * the parsed, normalized, percent-encoded (therefore ASCII-safe) form of
 * the SAME URL, so returning it keeps the redirect working without ever
 * producing a value that can crash the response.
 */
export function safeRedirectUrl(raw: unknown, baseUrl: string): string {
  const relative = safePath(raw, "");
  if (relative) return `${baseUrl}${relative}`;

  const s = String(raw ?? "");
  try {
    const u = new URL(s);
    if (u.origin === baseUrl) return u.href;
  } catch {
    // Malformed value (poisoned cookie, junk param) — treat as absent.
  }
  return baseUrl;
}

/**
 * Is `value` a callback-url that Auth.js will accept without throwing? This
 * mirrors @auth/core's OWN `isValidHttpUrl` check, which runs on the
 * `authjs.callback-url` COOKIE on every single request: a relative in-app
 * path (resolved against our origin) or an absolute http(s) URL. Anything
 * else makes @auth/core throw `InvalidCallbackUrl`, which 500s every page
 * render — so the proxy uses this to strip a poisoned cookie before Auth.js
 * ever sees it. Kept here (pure) so it is unit-testable.
 */
export function isValidCallbackCookie(value: string, origin: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value, value.startsWith("/") ? origin : undefined);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
