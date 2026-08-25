// Open-redirect guard tests.
import { describe, expect, test } from "vitest";
import { safePath, safeRedirectUrl, isValidCallbackCookie } from "@/lib/safePath";

const FALLBACK = "/account";

describe("safePath", () => {
  test("a normal in-app path is kept as-is", () => {
    expect(safePath("/properties/abc123", FALLBACK)).toBe("/properties/abc123");
    expect(safePath("/", FALLBACK)).toBe("/");
  });

  test("missing/empty/non-string values fall back", () => {
    expect(safePath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safePath("", FALLBACK)).toBe(FALLBACK);
    expect(safePath("account", FALLBACK)).toBe(FALLBACK);
  });

  test("absolute URLs to another host are rejected", () => {
    expect(safePath("https://evil.com/phish", FALLBACK)).toBe(FALLBACK);
  });

  test('protocol-relative ("//host") is rejected outright', () => {
    expect(safePath("//evil.com", FALLBACK)).toBe(FALLBACK);
  });

  // The backslash bypass: browsers treat "\" the same as "/" when parsing a
  // URL, so "/\evil.com" is navigated as "//evil.com" (a different host) even
  // though the raw string doesn't start with "//".
  test("the backslash bypass is rejected", () => {
    expect(safePath("/\\evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safePath("\\/evil.com", FALLBACK)).toBe(FALLBACK);
  });

  // The tab-smuggled variant: browsers drop tab/newline/CR before parsing, so
  // "/\t/evil.com" (a literal tab) also becomes "//evil.com".
  test("the tab-smuggled variant is rejected", () => {
    expect(safePath("/\t/evil.com", FALLBACK)).toBe(FALLBACK);
  });
});

// ---------------------------------------------------------------------------
// safeRedirectUrl — the post-login redirect / callback-url cookie sanitizer.
// The security bug it fixes: a malformed value (from a query param OR a
// poisoned `authjs.callback-url` cookie) reached `new URL(...)` without a base
// and threw "Invalid URL", 500-ing EVERY page render until the cookie was
// deleted. safeRedirectUrl must NEVER throw and must never leave our origin.
// ---------------------------------------------------------------------------
describe("safeRedirectUrl", () => {
  const BASE = "http://localhost:4005";

  test("a malformed value (the exact poisoned-cookie payload) is treated as absent → baseUrl, and never throws", () => {
    expect(safeRedirectUrl("not a url ///spaces", BASE)).toBe(BASE);
    expect(safeRedirectUrl("not-a-url", BASE)).toBe(BASE);
    expect(safeRedirectUrl("", BASE)).toBe(BASE);
    expect(safeRedirectUrl(undefined, BASE)).toBe(BASE);
  });

  test("a same-origin in-app path is kept and made absolute against baseUrl", () => {
    expect(safeRedirectUrl("/properties/abc", BASE)).toBe(`${BASE}/properties/abc`);
    expect(safeRedirectUrl("/", BASE)).toBe(`${BASE}/`);
  });

  test("a genuine absolute URL on our own origin is kept as-is", () => {
    expect(safeRedirectUrl(`${BASE}/account`, BASE)).toBe(`${BASE}/account`);
  });

  test("foreign hosts and the open-redirect tricks all collapse to baseUrl", () => {
    expect(safeRedirectUrl("https://evil.com/phish", BASE)).toBe(BASE);
    expect(safeRedirectUrl("//evil.com", BASE)).toBe(BASE);
    expect(safeRedirectUrl("/\\evil.com", BASE)).toBe(BASE);
    expect(safeRedirectUrl("/\t/evil.com", BASE)).toBe(BASE);
  });

  // Belt-and-braces: a battery of hostile values must all return WITHOUT throwing.
  test.each([
    "javascript:alert(1)",
    "http://",
    ":::",
    "\\\\evil",
    "%%%",
    "/\r\n//evil.com",
  ])("never throws and stays same-origin for %j", (bad) => {
    let threw = false;
    let out = "";
    try {
      out = safeRedirectUrl(bad, BASE);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(out.startsWith(BASE)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // The pentest finding: a homoglyph host (or an emoji elsewhere in the URL)
  // passes the `origin === baseUrl` same-origin check because `new URL(...)`
  // Unicode-normalizes the host before comparing — but the OLD code then
  // returned the raw, un-normalized string, which contains a character above
  // U+00FF. Node's Headers/cookie plumbing throws a TypeError on that
  // character, which Auth.js turned into a generic 500. The fix must return
  // the normalized `.href` (ASCII-safe) instead, and must never throw.
  // -------------------------------------------------------------------------
  test("a homoglyph host is normalized to ASCII-safe .href, never the raw string", () => {
    // A fullwidth "o" (U+FF4F) in "localhost" is a different codepoint than
    // the visible page, but the URL parser's IDNA mapping collapses it to a
    // plain ASCII "o" — so this string's origin equals BASE even though the
    // raw text is non-ASCII.
    const HOMOGLYPH_HOST = "http://lｏcalhost:4005/account";
    let threw = false;
    let out = "";
    try {
      out = safeRedirectUrl(HOMOGLYPH_HOST, BASE);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(out.startsWith(BASE)).toBe(true);
    expect(/^[\x00-\xFF]*$/.test(out)).toBe(true);
    expect(out === HOMOGLYPH_HOST).toBe(false);
  });

  test("an emoji elsewhere in an otherwise same-origin URL also comes back ASCII-safe", () => {
    const EMOJI_PATH = `${BASE}/properties/🏠-listing`; // 🏠
    let threw = false;
    let out = "";
    try {
      out = safeRedirectUrl(EMOJI_PATH, BASE);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(out.startsWith(BASE)).toBe(true);
    expect(/^[\x00-\xFF]*$/.test(out)).toBe(true);
    expect(out === EMOJI_PATH).toBe(false);
  });

  test("a value the raw string check would treat as valid same-origin is still always .href", () => {
    expect(safeRedirectUrl(`${BASE}/account`, BASE)).toBe(new URL(`${BASE}/account`).href);
  });
});

// ---------------------------------------------------------------------------
// isValidCallbackCookie — the proxy uses this to decide whether to STRIP a
// poisoned `authjs.callback-url` cookie before Auth.js re-validates it and
// 500s the whole site. It must mirror Auth.js: accept a same-origin path or
// an http(s) URL, reject everything else, and never throw.
// ---------------------------------------------------------------------------
describe("isValidCallbackCookie", () => {
  const ORIGIN = "http://localhost:4005";

  test("the exact poisoned value from the pentest is rejected (so it gets stripped)", () => {
    expect(isValidCallbackCookie("not a url ///spaces", ORIGIN)).toBe(false);
    expect(isValidCallbackCookie("", ORIGIN)).toBe(false);
    expect(isValidCallbackCookie("account", ORIGIN)).toBe(false);
    expect(isValidCallbackCookie("javascript:alert(1)", ORIGIN)).toBe(false);
  });

  test("what Auth.js itself writes (an absolute same-origin URL, or a path) is kept", () => {
    expect(isValidCallbackCookie(`${ORIGIN}/en/account`, ORIGIN)).toBe(true);
    expect(isValidCallbackCookie("/en/properties", ORIGIN)).toBe(true);
  });

  // A foreign http URL is still "valid http" to Auth.js's own check (origin
  // scoping happens in the redirect callback) — the point here is only that
  // it does not THROW, which is what caused the 500.
  test("a foreign http URL does not throw", () => {
    expect(isValidCallbackCookie("https://evil.com/x", ORIGIN)).toBe(true);
  });
});
