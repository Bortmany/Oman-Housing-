import { profileChangeNeedsReview } from "./agencyReview";
import { isUniqueViolation } from "./db/uniqueViolation";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else console.log(`ok   ${label} = ${actual}`);
}
const base = { nameEn: "Al Noor", nameAr: null, licenseNo: "123" };
expectEqual("same", profileChangeNeedsReview(base, { ...base }), false);
expectEqual("caseOnly", profileChangeNeedsReview(base, { ...base, nameEn: " al noor " }), false);
expectEqual("nameChange", profileChangeNeedsReview(base, { ...base, nameEn: "Other" }), true);
expectEqual("arabicName", profileChangeNeedsReview(base, { ...base, nameAr: "نور" }), true);
expectEqual("licenseChange", profileChangeNeedsReview(base, { ...base, licenseNo: "999" }), true);
expectEqual("licenseRemoved", profileChangeNeedsReview(base, { ...base, licenseNo: null }), true);

expectEqual("p2002", isUniqueViolation({ code: "P2002", meta: { target: ["email"] } }), true);
expectEqual("p2002field", isUniqueViolation({ code: "P2002", meta: { target: ["slug"] } }, "email"), false);
expectEqual("p2002fieldMatch", isUniqueViolation({ code: "P2002", meta: { target: "Agency_slug_key" } }, "slug"), true);
expectEqual("other", isUniqueViolation({ code: "P2025" }), false);
expectEqual("nonObject", isUniqueViolation(null), false);
if (failures) process.exit(1);
