// Anonymous-visitor cookie sign/verify tests. Run with: npm test
import { mintSignedAnonId, verifySignedAnonId } from "./anonId";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

const SECRET = "test-secret-do-not-use-in-real-life";
const OTHER_SECRET = "a-different-secret";

// A freshly minted cookie value verifies back to the same id.
{
  const { id, cookieValue } = mintSignedAnonId(SECRET);
  expectEqual("mint.verifies", verifySignedAnonId(cookieValue, SECRET), id);
}

// Two mints never collide and each verifies to its own id only.
{
  const a = mintSignedAnonId(SECRET);
  const b = mintSignedAnonId(SECRET);
  if (a.id === b.id) {
    console.error("FAIL mint.unique: two mints produced the same id");
    failures++;
  } else {
    console.log("ok   mint.unique");
  }
}

// Missing/empty cookie value: no id.
expectEqual("missing.rejected", verifySignedAnonId(undefined, SECRET), null);
expectEqual("empty.rejected", verifySignedAnonId("", SECRET), null);

// A value with no signature (or malformed shape) is rejected, not thrown.
expectEqual("noSignature.rejected", verifySignedAnonId("justanid", SECRET), null);
expectEqual("emptySignature.rejected", verifySignedAnonId("abc123.", SECRET), null);

// A visitor cannot invent their own id — verifying with the wrong secret
// (simulating a signature that wasn't actually minted by this server) fails.
{
  const { cookieValue } = mintSignedAnonId(OTHER_SECRET);
  expectEqual(
    "wrongSecret.rejected",
    verifySignedAnonId(cookieValue, SECRET),
    null,
  );
}

// Tampering with the id half (keeping the old signature) is caught.
{
  const { cookieValue } = mintSignedAnonId(SECRET);
  const [, sig] = cookieValue.split(".");
  const tampered = `deadbeefdeadbeefdeadbeefdeadbeef.${sig}`;
  expectEqual("tamperedId.rejected", verifySignedAnonId(tampered, SECRET), null);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll anonId tests passed.");
