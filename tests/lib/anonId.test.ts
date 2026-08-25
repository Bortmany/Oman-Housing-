// Anonymous-visitor cookie sign/verify tests.
import { describe, expect, test } from "vitest";
import { mintSignedAnonId, verifySignedAnonId } from "@/lib/anonId";

const SECRET = "test-secret-do-not-use-in-real-life";
const OTHER_SECRET = "a-different-secret";

describe("mintSignedAnonId / verifySignedAnonId", () => {
  test("a freshly minted cookie value verifies back to the same id", () => {
    const { id, cookieValue } = mintSignedAnonId(SECRET);
    expect(verifySignedAnonId(cookieValue, SECRET)).toBe(id);
  });

  test("two mints never collide and each verifies to its own id only", () => {
    const a = mintSignedAnonId(SECRET);
    const b = mintSignedAnonId(SECRET);
    expect(a.id).not.toBe(b.id);
  });

  test("missing/empty cookie value: no id", () => {
    expect(verifySignedAnonId(undefined, SECRET)).toBeNull();
    expect(verifySignedAnonId("", SECRET)).toBeNull();
  });

  test("a value with no signature (or malformed shape) is rejected, not thrown", () => {
    expect(verifySignedAnonId("justanid", SECRET)).toBeNull();
    expect(verifySignedAnonId("abc123.", SECRET)).toBeNull();
  });

  test("a visitor cannot invent their own id — the wrong secret fails verification", () => {
    // simulating a signature that wasn't actually minted by this server
    const { cookieValue } = mintSignedAnonId(OTHER_SECRET);
    expect(verifySignedAnonId(cookieValue, SECRET)).toBeNull();
  });

  test("tampering with the id half (keeping the old signature) is caught", () => {
    const { cookieValue } = mintSignedAnonId(SECRET);
    const [, sig] = cookieValue.split(".");
    const tampered = `deadbeefdeadbeefdeadbeefdeadbeef.${sig}`;
    expect(verifySignedAnonId(tampered, SECRET)).toBeNull();
  });
});
