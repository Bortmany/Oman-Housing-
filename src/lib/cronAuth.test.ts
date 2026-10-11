// Secret check for scheduled-job routes. Run with: npm test
import { checkCronAuth } from "./cronAuth";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${String(expected)}, got ${String(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const SECRET = "a-long-enough-secret-123";

expectEqual("unset secret refuses everyone (503)", checkCronAuth(`Bearer ${SECRET}`, undefined), "unavailable");
expectEqual("empty secret refuses everyone", checkCronAuth("Bearer x", ""), "unavailable");
expectEqual("15-character secret is too short", checkCronAuth("Bearer 123456789012345", "123456789012345"), "unavailable");
expectEqual("16-character secret is accepted", checkCronAuth("Bearer 1234567890123456", "1234567890123456"), "ok");
expectEqual("right secret passes", checkCronAuth(`Bearer ${SECRET}`, SECRET), "ok");
expectEqual("wrong secret is refused", checkCronAuth("Bearer not-the-secret-at-all", SECRET), "unauthorized");
expectEqual("same length, one character off", checkCronAuth(`Bearer ${SECRET.slice(0, -1)}X`, SECRET), "unauthorized");
expectEqual("no header is refused", checkCronAuth(null, SECRET), "unauthorized");
expectEqual("empty header is refused", checkCronAuth("", SECRET), "unauthorized");
expectEqual("wrong scheme is refused", checkCronAuth(`Basic ${SECRET}`, SECRET), "unauthorized");
expectEqual("bare token without Bearer is refused", checkCronAuth(SECRET, SECRET), "unauthorized");
expectEqual("Bearer with nothing after is refused", checkCronAuth("Bearer ", SECRET), "unauthorized");

if (failures > 0) {
  console.error(`\n${failures} cron-auth check(s) failed`);
  process.exit(1);
}
console.log("\nAll cron-auth checks passed.");
