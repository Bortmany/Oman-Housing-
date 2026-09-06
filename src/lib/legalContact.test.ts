// Legal contact address tests. Run with: npm test
//
// Proves the Privacy Policy / Terms of Use contact email falls back to the
// owner's address when PRIVACY_CONTACT_EMAIL is unset or unusable, and uses
// the override when a real address is given.
import {
  DEFAULT_PRIVACY_CONTACT_EMAIL,
  resolvePrivacyContactEmail,
} from "./legalContact";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

expectEqual("default address is the owner's", DEFAULT_PRIVACY_CONTACT_EMAIL, "naeljam@hotmail.com");
expectEqual("nothing set → default", resolvePrivacyContactEmail({}), DEFAULT_PRIVACY_CONTACT_EMAIL);
expectEqual(
  "blank → default",
  resolvePrivacyContactEmail({ PRIVACY_CONTACT_EMAIL: "   " }),
  DEFAULT_PRIVACY_CONTACT_EMAIL,
);
expectEqual(
  "not an email → default",
  resolvePrivacyContactEmail({ PRIVACY_CONTACT_EMAIL: "not an address" }),
  DEFAULT_PRIVACY_CONTACT_EMAIL,
);
expectEqual(
  "override used",
  resolvePrivacyContactEmail({ PRIVACY_CONTACT_EMAIL: "privacy@example.om" }),
  "privacy@example.om",
);
expectEqual(
  "override is trimmed",
  resolvePrivacyContactEmail({ PRIVACY_CONTACT_EMAIL: "  privacy@example.om \n" }),
  "privacy@example.om",
);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll legal-contact tests passed.");
