let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

import { landingForRole } from "./landing";

expectEqual("agency lands on /agency", landingForRole("AGENCY"), "/agency");
expectEqual("admin lands on /admin", landingForRole("ADMIN"), "/admin");
expectEqual("user lands on /account", landingForRole("USER"), "/account");
expectEqual("unknown role lands on /account", landingForRole(undefined), "/account");
expectEqual("odd role lands on /account", landingForRole("agency"), "/account");

if (failures) process.exit(1);
