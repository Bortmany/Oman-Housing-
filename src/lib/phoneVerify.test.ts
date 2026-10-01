// Phone-verification rule tests. Run with: npm test
import {
  MAX_ATTEMPTS,
  codeExpiry,
  codeState,
  cooldownSecondsLeft,
  decideCheck,
  generateCode,
  hashCode,
  hashesMatch,
  isPhoneVerified,
  isWellFormedCode,
  maskPhone,
  normalizeCode,
  parseOmaniMobile,
  resolveSmsMode,
  toE164,
  verifiedPhoneOf,
} from "./phoneVerify";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

// --- number format ---
expectEqual("plain mobile", parseOmaniMobile("9123 4567")?.stored, "+968 91234567");
expectEqual("with +968", parseOmaniMobile("+968 9123 4567")?.e164, "+96891234567");
expectEqual("with 00968", parseOmaniMobile("0096891234567")?.digits, "91234567");
expectEqual("7-prefix ok", parseOmaniMobile("71234567")?.digits, "71234567");
expectEqual("arabic digits", parseOmaniMobile("٩١٢٣٤٥٦٧")?.digits, "91234567");
expectEqual("landline 2 rejected", parseOmaniMobile("24123456"), null);
expectEqual("too short rejected", parseOmaniMobile("912345"), null);
expectEqual("too long rejected", parseOmaniMobile("912345678"), null);
expectEqual("foreign number rejected", parseOmaniMobile("+971 50 123 4567"), null);
expectEqual("letters rejected", parseOmaniMobile("9123abcd"), null);
expectEqual("empty rejected", parseOmaniMobile(""), null);
expectEqual("toE164", toE164("+968 91234567"), "+96891234567");
expectEqual("mask", maskPhone("+968 91234567"), "+968 •••• 4567");
expectEqual("mask empty", maskPhone(null), "");

// --- code shape ---
expectEqual("normalize strips spaces", normalizeCode("123 456"), "123456");
expectEqual("normalize arabic digits", normalizeCode("١٢٣٤٥٦"), "123456");
expectEqual("well formed", isWellFormedCode("012345"), true);
expectEqual("5 digits not ok", isWellFormedCode("12345"), false);
let allGood = true;
for (let i = 0; i < 200; i++) if (!isWellFormedCode(generateCode())) allGood = false;
expectEqual("generated codes are 6 digits", allGood, true);

// --- hash ---
const base = { userId: "u1", phone: "+96891234567", code: "123456", secret: "s3cret-s3cret" };
const h = hashCode(base);
expectEqual("hash matches itself", hashesMatch(h, hashCode(base)), true);
expectEqual("hash differs for other code", hashesMatch(h, hashCode({ ...base, code: "123457" })), false);
expectEqual("hash differs for other number", hashesMatch(h, hashCode({ ...base, phone: "+96871234567" })), false);
expectEqual("hash differs for other user", hashesMatch(h, hashCode({ ...base, userId: "u2" })), false);
expectEqual("hash differs for other key", hashesMatch(h, hashCode({ ...base, secret: "other-other-1" })), false);
expectEqual("bad hash never matches", hashesMatch(h, "zz"), false);
expectEqual("hash does not contain the code", h.includes("123456"), false);

// --- cooldown & expiry ---
const t0 = new Date("2026-10-01T10:00:00Z");
expectEqual("no send yet", cooldownSecondsLeft(null, t0), 0);
expectEqual("just sent", cooldownSecondsLeft(t0, t0), 60);
expectEqual("42s left", cooldownSecondsLeft(t0, new Date(t0.getTime() + 18_000)), 42);
expectEqual("after 60s", cooldownSecondsLeft(t0, new Date(t0.getTime() + 60_000)), 0);
expectEqual("expiry is 10 minutes", codeExpiry(t0).getTime() - t0.getTime(), 600_000);

const live = {
  phoneVerifyPending: "+968 91234567",
  phoneVerifyExpiresAt: codeExpiry(t0),
  phoneVerifyAttempts: 0,
};
expectEqual("none", codeState({ ...live, phoneVerifyPending: null }, t0), "none");
expectEqual("active", codeState(live, t0), "active");
expectEqual("active at 9m59s", codeState(live, new Date(t0.getTime() + 599_000)), "active");
expectEqual("expired at 10m", codeState(live, new Date(t0.getTime() + 600_000)), "expired");
expectEqual("voided (no expiry) is expired", codeState({ ...live, phoneVerifyExpiresAt: null }, t0), "expired");
expectEqual("locked after 5", codeState({ ...live, phoneVerifyAttempts: MAX_ATTEMPTS }, t0), "locked");

// --- attempts ---
expectEqual("right code verifies", decideCheck("active", 0, true), { result: "verified" });
expectEqual("wrong 1", decideCheck("active", 0, false), { result: "wrong", attempts: 1, triesLeft: 4 });
expectEqual("wrong 4", decideCheck("active", 3, false), { result: "wrong", attempts: 4, triesLeft: 1 });
expectEqual("5th wrong locks", decideCheck("active", 4, false), { result: "locked", attempts: 5 });
expectEqual("locked stays locked even if right", decideCheck("locked", 5, true), { result: "locked", attempts: 5 });
expectEqual("expired even if right", decideCheck("expired", 0, true), { result: "expired" });
expectEqual("none is expired", decideCheck("none", 0, true), { result: "expired" });

// --- helpers for owner listing ---
expectEqual("verified user", isPhoneVerified({ phone: "+968 91234567", phoneVerifiedAt: t0 }), true);
expectEqual("phone but never verified", isPhoneVerified({ phone: "+968 91234567", phoneVerifiedAt: null }), false);
expectEqual("verified but no phone", isPhoneVerified({ phone: null, phoneVerifiedAt: t0 }), false);
expectEqual("no user", isPhoneVerified(null), false);
expectEqual("verifiedPhoneOf", verifiedPhoneOf({ phone: "+968 91234567", phoneVerifiedAt: t0 }), "+968 91234567");
expectEqual("verifiedPhoneOf unverified", verifiedPhoneOf({ phone: "+968 91234567", phoneVerifiedAt: null }), null);

// --- mode ---
const keys = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_VERIFY_SERVICE_SID: "VA1" };
expectEqual("all keys -> twilio", resolveSmsMode({ ...keys, NODE_ENV: "production" }), "twilio");
expectEqual("all keys dev -> twilio", resolveSmsMode({ ...keys, NODE_ENV: "development" }), "twilio");
expectEqual("one key missing in prod -> closed", resolveSmsMode({ ...keys, TWILIO_AUTH_TOKEN: "", NODE_ENV: "production" }), "closed");
expectEqual("no keys in prod -> closed", resolveSmsMode({ NODE_ENV: "production" }), "closed");
expectEqual("no keys in dev -> dev", resolveSmsMode({ NODE_ENV: "development" }), "dev");
expectEqual("no keys, no env -> dev", resolveSmsMode({}), "dev");

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll phone-verification tests passed.");
