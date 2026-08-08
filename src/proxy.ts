import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { isValidCallbackCookie } from "./lib/safePath";

// Locale detection + /en//ar prefixing. Role-based access control lives in
// the (admin)/(app)/(agency) route-group layouts, not here.
const intlMiddleware = createMiddleware(routing);

// Auth.js re-validates the `authjs.callback-url` COOKIE on every request
// (its internal `isValidHttpUrl` in @auth/core/lib/utils/assert.js). A
// malformed value there — e.g. from a crafted `/login?callbackUrl=<junk>`
// link that poisons a victim's cookie — makes it throw `InvalidCallbackUrl`,
// which 500s EVERY page render until the cookie is manually deleted. We can't
// stop Auth.js from checking, so we sanitise the cookie BEFORE it reaches the
// app: rebuild the request with the bad cookie removed from the `Cookie`
// header (so Auth.js sees it as absent), then clear it in the browser too so
// it self-heals. (The secure-prefix variant is handled for HTTPS.)
const CALLBACK_COOKIE_NAMES = [
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

/** decodeURIComponent that never throws — a value like "%%%" falls back raw. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function proxy(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const cookieHeader = request.headers.get("cookie") ?? "";

  // Work off the RAW Cookie header, not request.cookies.get(): the latter
  // silently mishandles a badly percent-encoded value (e.g. "%%%") so a
  // poisoned cookie could slip through, while Auth.js still chokes on it.
  const cleared: string[] = [];
  const kept = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((part) => {
      const eq = part.indexOf("=");
      const name = (eq === -1 ? part : part.slice(0, eq)).trim();
      if (!CALLBACK_COOKIE_NAMES.includes(name)) return true;
      const value = eq === -1 ? "" : safeDecode(part.slice(eq + 1));
      if (isValidCallbackCookie(value, origin)) return true;
      cleared.push(name);
      return false; // drop the poisoned callback cookie
    });

  // API routes (Auth.js's own `/api/auth/*`, `/api/health`) are NOT locale-
  // routed, so next-intl must never touch them — they just pass through.
  // Everything else goes through next-intl for locale detection/prefixing.
  const isApi = request.nextUrl.pathname.startsWith("/api");

  // No poisoned callback cookie — normal path, untouched.
  if (cleared.length === 0) {
    return isApi ? NextResponse.next() : intlMiddleware(request);
  }

  // Rebuild the request with the bad cookie(s) removed so everything
  // downstream (Auth.js's assert on both page renders AND `/api/auth/*`, plus
  // RSC `auth()`) sees them as absent. Reconstructing/forwarding the headers
  // is what actually carries the change — mutating `request.cookies` alone
  // does not survive next-intl's response.
  const headers = new Headers(request.headers);
  if (kept.length) headers.set("cookie", kept.join("; "));
  else headers.delete("cookie");

  const response = isApi
    ? NextResponse.next({ request: { headers } })
    : intlMiddleware(new NextRequest(request.url, { headers, method: request.method }));

  // Tell the browser to forget the poisoned cookie so it doesn't keep sending
  // it (a well-formed one from a later login is left untouched).
  for (const name of cleared) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return response;
}

// Run on everything except Next internals and static files — INCLUDING /api,
// so a poisoned callback-url cookie is stripped before Auth.js's endpoints
// (and any route that calls `auth()`) can choke on it. next-intl is still only
// invoked for non-/api paths (see `isApi` above).
export const config = {
  matcher: "/((?!_next|_vercel|.*\\..*).*)",
};
