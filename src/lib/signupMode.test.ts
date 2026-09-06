// Sign-up mode tests. Run with: npm test
//
// Proves the invitation-only gate that both sign-up forms (register and
// list-with-us) rely on: production is CLOSED by default, INVITE when codes
// exist, OPEN only with the explicit flag; and the code check accepts the
// right code, rejects wrong/short/missing ones, and compares in constant time.
import {
  isValidInviteCode,
  parseInviteCodes,
  resolveSignupMode,
} from "./signupMode";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

// --- Mode resolution -------------------------------------------------------

expectEqual("production, nothing set → closed", resolveSignupMode({ NODE_ENV: "production" }), "closed");
expectEqual(
  "production, empty codes → closed",
  resolveSignupMode({ NODE_ENV: "production", SIGNUP_INVITE_CODES: " , " }),
  "closed",
);
expectEqual(
  "production, only short codes → closed (unusable codes don't count)",
  resolveSignupMode({ NODE_ENV: "production", SIGNUP_INVITE_CODES: "abc,1234567" }),
  "closed",
);
expectEqual(
  "production, codes set → invite",
  resolveSignupMode({ NODE_ENV: "production", SIGNUP_INVITE_CODES: "muscat-2026-alpha" }),
  "invite",
);
expectEqual(
  "production, SIGNUPS_OPEN=true → open",
  resolveSignupMode({ NODE_ENV: "production", SIGNUPS_OPEN: "true" }),
  "open",
);
expectEqual(
  "production, SIGNUPS_OPEN=true wins over codes → open",
  resolveSignupMode({ NODE_ENV: "production", SIGNUPS_OPEN: "true", SIGNUP_INVITE_CODES: "muscat-2026-alpha" }),
  "open",
);
expectEqual(
  "production, SIGNUPS_OPEN=yes is not the flag → closed",
  resolveSignupMode({ NODE_ENV: "production", SIGNUPS_OPEN: "yes" }),
  "closed",
);
expectEqual("development, nothing set → open", resolveSignupMode({ NODE_ENV: "development" }), "open");
expectEqual("test, nothing set → open", resolveSignupMode({ NODE_ENV: "test" }), "open");
expectEqual("no NODE_ENV, nothing set → open", resolveSignupMode({}), "open");
expectEqual(
  "development, codes set → invite",
  resolveSignupMode({ NODE_ENV: "development", SIGNUP_INVITE_CODES: "muscat-2026-alpha" }),
  "invite",
);

// --- Code parsing ----------------------------------------------------------

expectEqual("parse: undefined → none", parseInviteCodes(undefined).length, 0);
expectEqual(
  "parse: trims and drops short entries",
  JSON.stringify(parseInviteCodes(" muscat-2026-alpha , short ,salalah-2026-beta,")),
  JSON.stringify(["muscat-2026-alpha", "salalah-2026-beta"]),
);

// --- Code check ------------------------------------------------------------

const CODES = ["muscat-2026-alpha", "salalah-2026-beta"];
expectEqual("right code (first) accepted", isValidInviteCode("muscat-2026-alpha", CODES), true);
expectEqual("right code (second) accepted", isValidInviteCode("salalah-2026-beta", CODES), true);
expectEqual("right code with surrounding spaces accepted", isValidInviteCode("  salalah-2026-beta ", CODES), true);
expectEqual("wrong code rejected", isValidInviteCode("muscat-2026-alphb", CODES), false);
expectEqual("prefix of a code rejected", isValidInviteCode("muscat-2026", CODES), false);
expectEqual("longer than a code rejected", isValidInviteCode("muscat-2026-alpha-extra", CODES), false);
expectEqual("case matters", isValidInviteCode("MUSCAT-2026-ALPHA", CODES), false);
expectEqual("missing (null) rejected", isValidInviteCode(null, CODES), false);
expectEqual("missing (undefined) rejected", isValidInviteCode(undefined, CODES), false);
expectEqual("empty string rejected", isValidInviteCode("", CODES), false);
expectEqual("non-string rejected", isValidInviteCode(12345678, CODES), false);
expectEqual("no codes configured → nothing is valid", isValidInviteCode("muscat-2026-alpha", []), false);

// --- Constant time ---------------------------------------------------------
//
// Node's timingSafeEqual throws when the two buffers differ in length, so
// comparing raw strings would leak length through an exception (and a
// short-circuit `||` would leak which code matched). The check hashes both
// sides to a fixed 32 bytes and visits every code. If that ever regresses to a
// raw compare, a different-length guess throws here instead of returning false.
let threw = false;
let result: boolean | undefined;
try {
  result = isValidInviteCode("x".repeat(40), CODES);
} catch {
  threw = true;
}
expectEqual("different-length guess does not throw", threw, false);
expectEqual("different-length guess is rejected", result, false);

// Sanity timing check: a guess that matches nothing versus one that matches
// the last code should take about the same time. Generous tolerance — this
// only catches a gross regression (e.g. an early return before hashing).
function timeIt(guess: string): number {
  const start = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) isValidInviteCode(guess, CODES);
  return Number(process.hrtime.bigint() - start);
}
timeIt("warm-up-guess-000"); // JIT warm-up
const wrongNs = timeIt("zzzzzzzzzzzzzzzzz");
const rightNs = timeIt("salalah-2026-beta");
const ratio = Math.max(wrongNs, rightNs) / Math.min(wrongNs, rightNs);
expectEqual("wrong vs right guess within 3x timing", ratio < 3, true);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll signup-mode tests passed.");
