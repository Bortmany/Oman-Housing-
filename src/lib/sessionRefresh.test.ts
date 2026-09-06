// Session role-refresh tests. Run with: npm test
//
// Core guarantee under test: a role change or agency un-approval made in the
// database reaches an already-signed-in session within ROLE_REFRESH_MS,
// without a database read on every request in between.
import {
  ROLE_REFRESH_MS,
  applyFreshUser,
  shouldRefreshRole,
  type RoleSnapshot,
} from "./sessionRefresh";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

const NOW = 1_800_000_000_000;

// --- shouldRefreshRole ---

// A token that has never been checked is always due.
expectEqual("refresh.neverChecked", shouldRefreshRole(undefined, NOW), true);

// Checked just now: not due — this is what keeps the DB quiet per request.
expectEqual("refresh.justChecked", shouldRefreshRole(NOW - 1000, NOW), false);

// Checked 4m59s ago: still not due.
expectEqual(
  "refresh.underInterval",
  shouldRefreshRole(NOW - (ROLE_REFRESH_MS - 1000), NOW),
  false,
);

// Exactly 5 minutes: due.
expectEqual(
  "refresh.atInterval",
  shouldRefreshRole(NOW - ROLE_REFRESH_MS, NOW),
  true,
);

// A stamp in the future (tampered or clock skew) is not trusted: due.
expectEqual("refresh.futureStamp", shouldRefreshRole(NOW + 60_000, NOW), true);

// Garbage in the token: due.
expectEqual("refresh.nanStamp", shouldRefreshRole(Number.NaN, NOW), true);

// --- applyFreshUser ---

// Un-approving an agency lands on the token.
{
  const token = {
    role: "AGENCY",
    tier: "FREE",
    agencyId: "ag1",
    agencyApproved: true,
    roleCheckedAt: NOW - ROLE_REFRESH_MS,
  };
  const out = applyFreshUser(
    token,
    { role: "AGENCY", tier: "FREE", agencyId: "ag1", agency: { isApproved: false } },
    NOW,
  );
  expectEqual("apply.unapproved.notNull", out !== null, true);
  expectEqual("apply.unapproved.flag", out?.agencyApproved, false);
  expectEqual("apply.unapproved.stamped", out?.roleCheckedAt, NOW);
}

// A role change (admin demoted to USER) lands on the token.
{
  const token: RoleSnapshot = { role: "ADMIN", tier: "FREE", agencyId: null };
  const out = applyFreshUser(
    token,
    { role: "USER", tier: "PREMIUM", agencyId: null, agency: null },
    NOW,
  );
  expectEqual("apply.demoted.role", out?.role, "USER");
  expectEqual("apply.demoted.tier", out?.tier, "PREMIUM");
  expectEqual("apply.demoted.noAgency", out?.agencyApproved, false);
}

// A user deleted from the database ends the session (null = sign out).
{
  const token: RoleSnapshot = { role: "USER", tier: "FREE", agencyId: null };
  expectEqual("apply.deletedUser", applyFreshUser(token, null, NOW), null);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll session-refresh tests passed.");
