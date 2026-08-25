// Route-group access-gate tests.
//
// These prove the pentest fix: an UNAUTHENTICATED request (role = null) and a
// NON-ADMIN request (e.g. an AGENCY user) to every admin page are turned into
// a redirect BEFORE the page renders — so the middleware never lets the admin
// page's Server Component run its DB query and stream another tenant's buyer
// PII into the response body. A redirect response has an EMPTY body, so there
// is nothing left to leak. Imported directly (no next/* deps) so it runs as a
// plain unit test, same as the other pure-function suites.
import { describe, expect, test } from "vitest";
import {
  gateDecision,
  localeFromPath,
  protectedSegment,
} from "@/lib/adminGate";

// Every admin page in the (admin) route group, in the locale-prefixed form the
// browser (and curl) requests. If any of these ever streams to a non-admin,
// buyer PII leaks — so each must redirect for anyone who isn't ADMIN.
const ADMIN_PAGES = [
  "/en/admin",
  "/en/admin/agencies",
  "/en/admin/inquiries",
  "/en/admin/inquiries?status=NEW",
  "/en/admin/listings",
  "/en/admin/listings/new",
  "/en/admin/listings/abc123",
  "/en/admin/market-stats",
  "/en/admin/market-stats/new",
  "/en/admin/properties",
  "/en/admin/properties/new",
  "/en/admin/properties/abc123",
  "/en/admin/review",
  // Arabic locale + the bare (pre-locale-prefix) form the middleware may see.
  "/ar/admin/inquiries",
  "/admin/inquiries",
];

describe("gateDecision — admin route group", () => {
  test.each(ADMIN_PAGES)("%s is redirected for unauthenticated, agency, and allowed for admin", (page) => {
    const path = page.split("?")[0];
    // Unauthenticated (no session token → role null): must redirect.
    expect(gateDecision(path, null).action).toBe("redirect");
    // Signed in as a non-admin AGENCY user: must still redirect (no
    // cross-tenant admin inbox for an agency account).
    expect(gateDecision(path, "AGENCY").action).toBe("redirect");
    // A real ADMIN is allowed through.
    expect(gateDecision(path, "ADMIN").action).toBe("allow");
  });
});

describe("localeFromPath", () => {
  test("the redirect keeps the caller's locale so an Arabic visitor lands on the Arabic login page", () => {
    expect(localeFromPath("/ar/admin/inquiries")).toBe("ar");
    expect(localeFromPath("/admin/inquiries")).toBe("en");
  });
});

describe("gateDecision — agency route group", () => {
  // Agency group: needs the AGENCY role; ADMIN and unauthenticated are bounced
  // (agency pages are scoped to the session's own agencyId).
  test("unauth blocked", () => {
    expect(gateDecision("/en/agency/enquiries", null).action).toBe("redirect");
  });
  test("admin blocked", () => {
    expect(gateDecision("/en/agency/enquiries", "ADMIN").action).toBe("redirect");
  });
  test("agency allowed", () => {
    expect(gateDecision("/en/agency/enquiries", "AGENCY").action).toBe("allow");
  });
});

describe("gateDecision — public pages", () => {
  test.each(["/en", "/ar", "/en/market", "/en/properties", "/en/login", "/en/list-with-us"])(
    "%s is never gated",
    (publicPath) => {
      expect(gateDecision(publicPath, null).action).toBe("allow");
      expect(protectedSegment(publicPath)).toBeNull();
    },
  );
});
