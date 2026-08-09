// Route-group access-gate tests. Run with: npm test
//
// These prove the pentest fix: an UNAUTHENTICATED request (role = null) and a
// NON-ADMIN request (e.g. an AGENCY user) to every admin page are turned into
// a redirect BEFORE the page renders — so the middleware never lets the admin
// page's Server Component run its DB query and stream another tenant's buyer
// PII into the response body. A redirect response has an EMPTY body, so there
// is nothing left to leak. Imported directly (no next/* deps) so it runs under
// `tsx` like the other unit tests.
import {
  gateDecision,
  localeFromPath,
  protectedSegment,
} from "./adminGate";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

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

for (const page of ADMIN_PAGES) {
  const path = page.split("?")[0];
  // Unauthenticated (no session token → role null): must redirect.
  expectEqual(
    `unauth blocked: ${page}`,
    gateDecision(path, null).action,
    "redirect",
  );
  // Signed in as a non-admin AGENCY user: must still redirect (no cross-tenant
  // admin inbox for an agency account).
  expectEqual(
    `agency blocked from admin: ${page}`,
    gateDecision(path, "AGENCY").action,
    "redirect",
  );
  // A real ADMIN is allowed through.
  expectEqual(
    `admin allowed: ${page}`,
    gateDecision(path, "ADMIN").action,
    "allow",
  );
}

// The redirect keeps the caller's locale so an Arabic visitor lands on the
// Arabic login page.
expectEqual("locale preserved (ar)", localeFromPath("/ar/admin/inquiries"), "ar");
expectEqual("locale default (bare)", localeFromPath("/admin/inquiries"), "en");

// Agency group: needs the AGENCY role; ADMIN and unauthenticated are bounced
// (agency pages are scoped to the session's own agencyId).
expectEqual("agency page: unauth blocked", gateDecision("/en/agency/enquiries", null).action, "redirect");
expectEqual("agency page: admin blocked", gateDecision("/en/agency/enquiries", "ADMIN").action, "redirect");
expectEqual("agency page: agency allowed", gateDecision("/en/agency/enquiries", "AGENCY").action, "allow");

// Public pages are never gated.
for (const publicPath of ["/en", "/ar", "/en/market", "/en/properties", "/en/login", "/en/list-with-us"]) {
  expectEqual(`public allowed: ${publicPath}`, gateDecision(publicPath, null).action, "allow");
  expectEqual(`public segment null: ${publicPath}`, protectedSegment(publicPath), null);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll admin-gate tests passed.");
