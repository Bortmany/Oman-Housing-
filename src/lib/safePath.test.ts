// Open-redirect guard tests. Run with: npm test
import { safePath, safeRedirectUrl, isValidCallbackCookie } from "./safePath";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

const FALLBACK = "/account";

// A normal in-app path is kept as-is.
expectEqual("plainPath.kept", safePath("/properties/abc123", FALLBACK), "/properties/abc123");
expectEqual("rootPath.kept", safePath("/", FALLBACK), "/");

// Missing/empty/non-string values fall back.
expectEqual("missing.fallsBack", safePath(undefined, FALLBACK), FALLBACK);
expectEqual("empty.fallsBack", safePath("", FALLBACK), FALLBACK);
expectEqual("notAPath.fallsBack", safePath("account", FALLBACK), FALLBACK);

// Absolute URLs to another host are rejected.
expectEqual("absoluteUrl.fallsBack", safePath("https://evil.com/phish", FALLBACK), FALLBACK);

// Protocol-relative ("//host") is rejected outright.
expectEqual("protocolRelative.fallsBack", safePath("//evil.com", FALLBACK), FALLBACK);

// The backslash bypass: browsers treat "\" the same as "/" when parsing a
// URL, so "/\evil.com" is navigated as "//evil.com" (a different host) even
// though the raw string doesn't start with "//".
expectEqual("backslashBypass.fallsBack", safePath("/\\evil.com", FALLBACK), FALLBACK);
expectEqual("backslashBypass.mixed.fallsBack", safePath("\\/evil.com", FALLBACK), FALLBACK);

// The tab-smuggled variant: browsers drop tab/newline/CR before parsing, so
// "/\t/evil.com" (a literal tab) also becomes "//evil.com".
expectEqual(
  "tabSmuggled.fallsBack",
  safePath("/\t/evil.com", FALLBACK),
  FALLBACK,
);

// ---------------------------------------------------------------------------
// safeRedirectUrl — the post-login redirect / callback-url cookie sanitizer.
// The security bug it fixes: a malformed value (from a query param OR a
// poisoned `authjs.callback-url` cookie) reached `new URL(...)` without a base
// and threw "Invalid URL", 500-ing EVERY page render until the cookie was
// deleted. safeRedirectUrl must NEVER throw and must never leave our origin.
// ---------------------------------------------------------------------------
const BASE = "http://localhost:4005";

// A malformed value (the exact poisoned-cookie payload from the pentest) is
// treated as absent → baseUrl, and never throws.
expectEqual("redirect.poisoned.spaces", safeRedirectUrl("not a url ///spaces", BASE), BASE);
expectEqual("redirect.poisoned.bareword", safeRedirectUrl("not-a-url", BASE), BASE);
expectEqual("redirect.empty", safeRedirectUrl("", BASE), BASE);
expectEqual("redirect.missing", safeRedirectUrl(undefined, BASE), BASE);

// A same-origin in-app path is kept and made absolute against baseUrl.
expectEqual("redirect.path.kept", safeRedirectUrl("/properties/abc", BASE), `${BASE}/properties/abc`);
expectEqual("redirect.root.kept", safeRedirectUrl("/", BASE), `${BASE}/`);

// A genuine absolute URL on our own origin is kept as-is.
expectEqual("redirect.sameOriginAbsolute.kept", safeRedirectUrl(`${BASE}/account`, BASE), `${BASE}/account`);

// Foreign hosts and the open-redirect tricks all collapse to baseUrl.
expectEqual("redirect.foreignHost", safeRedirectUrl("https://evil.com/phish", BASE), BASE);
expectEqual("redirect.protocolRelative", safeRedirectUrl("//evil.com", BASE), BASE);
expectEqual("redirect.backslashBypass", safeRedirectUrl("/\\evil.com", BASE), BASE);
expectEqual("redirect.tabSmuggled", safeRedirectUrl("/\t/evil.com", BASE), BASE);

// Belt-and-braces: a battery of hostile values must all return WITHOUT throwing.
for (const bad of ["javascript:alert(1)", "http://", ":::", "\\\\evil", "%%%", "/\r\n//evil.com"]) {
  let threw = false;
  let out = "";
  try {
    out = safeRedirectUrl(bad, BASE);
  } catch {
    threw = true;
  }
  expectEqual(`redirect.noThrow[${JSON.stringify(bad)}]`, threw, false);
  // Whatever it returns must be same-origin (starts with baseUrl).
  expectEqual(`redirect.sameOrigin[${JSON.stringify(bad)}]`, out.startsWith(BASE), true);
}

// ---------------------------------------------------------------------------
// The pentest finding: a homoglyph host (or an emoji elsewhere in the URL)
// passes the `origin === baseUrl` same-origin check because `new URL(...)`
// Unicode-normalizes the host before comparing — but the OLD code then
// returned the raw, un-normalized string, which contains a character above
// U+00FF. Node's Headers/cookie plumbing throws a TypeError on that
// character, which Auth.js turned into a generic 500. The fix must return
// the normalized `.href` (ASCII-safe) instead, and must never throw.
// ---------------------------------------------------------------------------

// A fullwidth "o" (U+FF4F) in "localhost" is a different codepoint than the
// visible page, but the URL parser's IDNA mapping collapses it to a plain
// ASCII "o" — so this string's origin equals BASE even though the raw text
// is non-ASCII. Every character of the value returned must be ASCII/Latin1
// (so it can never crash a cookie/header write), and it must stay same-origin.
const HOMOGLYPH_HOST = "http://lｏcalhost:4005/account";
{
  let threw = false;
  let out = "";
  try {
    out = safeRedirectUrl(HOMOGLYPH_HOST, BASE);
  } catch {
    threw = true;
  }
  expectEqual("redirect.homoglyphHost.noThrow", threw, false);
  expectEqual("redirect.homoglyphHost.sameOrigin", out.startsWith(BASE), true);
  expectEqual("redirect.homoglyphHost.isLatin1", /^[\x00-\xFF]*$/.test(out), true);
  // Never the raw un-normalized string.
  expectEqual("redirect.homoglyphHost.notRaw", out === HOMOGLYPH_HOST, false);
}

// An emoji elsewhere in an otherwise same-origin URL (path only affects the
// path, not the origin, so the same-origin check still passes) must also
// come back ASCII-safe (percent-encoded) rather than raw.
const EMOJI_PATH = `${BASE}/properties/🏠-listing`; // 🏠
{
  let threw = false;
  let out = "";
  try {
    out = safeRedirectUrl(EMOJI_PATH, BASE);
  } catch {
    threw = true;
  }
  expectEqual("redirect.emojiPath.noThrow", threw, false);
  expectEqual("redirect.emojiPath.sameOrigin", out.startsWith(BASE), true);
  expectEqual("redirect.emojiPath.isLatin1", /^[\x00-\xFF]*$/.test(out), true);
  expectEqual("redirect.emojiPath.notRaw", out === EMOJI_PATH, false);
}

// A value the raw string check would treat as a valid-looking same-origin
// prefix must still never be handed back verbatim — always `.href`.
expectEqual(
  "redirect.sameOriginAbsolute.isHref",
  safeRedirectUrl(`${BASE}/account`, BASE),
  new URL(`${BASE}/account`).href,
);

// ---------------------------------------------------------------------------
// isValidCallbackCookie — the proxy uses this to decide whether to STRIP a
// poisoned `authjs.callback-url` cookie before Auth.js re-validates it and
// 500s the whole site. It must mirror Auth.js: accept a same-origin path or
// an http(s) URL, reject everything else, and never throw.
// ---------------------------------------------------------------------------
const ORIGIN = "http://localhost:4005";

// The exact poisoned value from the pentest is rejected (so it gets stripped).
expectEqual("cookie.poisoned.rejected", isValidCallbackCookie("not a url ///spaces", ORIGIN), false);
expectEqual("cookie.empty.rejected", isValidCallbackCookie("", ORIGIN), false);
expectEqual("cookie.bareword.rejected", isValidCallbackCookie("account", ORIGIN), false);
expectEqual("cookie.javascript.rejected", isValidCallbackCookie("javascript:alert(1)", ORIGIN), false);

// What Auth.js itself writes (an absolute same-origin URL, or a path) is kept.
expectEqual("cookie.absolute.kept", isValidCallbackCookie(`${ORIGIN}/en/account`, ORIGIN), true);
expectEqual("cookie.path.kept", isValidCallbackCookie("/en/properties", ORIGIN), true);
// A foreign http URL is still "valid http" to Auth.js's own check (origin
// scoping happens in the redirect callback) — the point here is only that it
// does not THROW, which is what caused the 500.
expectEqual("cookie.foreignHttp.noThrow", isValidCallbackCookie("https://evil.com/x", ORIGIN), true);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll safePath tests passed.");
