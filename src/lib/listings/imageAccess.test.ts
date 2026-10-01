// Photo access decision — pure checks. Run with: npm run test:unit
import { decideImageAccess, type ImageListing } from "./imageAccess";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const L = (status: ImageListing["status"], createdById = "owner", agencyId: string | null = null): ImageListing => ({
  status, createdById, agencyId,
});
const user = (userId: string, role = "USER", agencyId: string | null = null) => ({ userId, role, agencyId });

expectEqual("not linked to a property stays public", decideImageAccess(null, null), "public");
expectEqual("no listings (reference home) is public", decideImageAccess([], null), "public");
expectEqual("live listing is public to a visitor", decideImageAccess([L("ACTIVE")], null), "public");
expectEqual("draft hidden from a visitor", decideImageAccess([L("DRAFT")], null), "deny");
expectEqual("pending hidden from another user", decideImageAccess([L("PENDING_REVIEW")], user("other")), "deny");
expectEqual("rejected hidden from a visitor", decideImageAccess([L("REJECTED")], null), "deny");
expectEqual("owner sees own draft, privately", decideImageAccess([L("DRAFT")], user("owner")), "private");
expectEqual("admin sees a pending one, privately", decideImageAccess([L("PENDING_REVIEW")], user("a", "ADMIN")), "private");
expectEqual("creating agency sees it", decideImageAccess([L("PENDING_REVIEW", "u1", "ag1")], user("u2", "AGENCY", "ag1")), "private");
expectEqual("another agency does not", decideImageAccess([L("PENDING_REVIEW", "u1", "ag1")], user("u3", "AGENCY", "ag2")), "deny");
expectEqual("user without agency doesn't match null agency", decideImageAccess([L("DRAFT", "u1", null)], user("u9")), "deny");

if (failures > 0) {
  console.error(`\n${failures} image access test(s) failed`);
  process.exit(1);
}
