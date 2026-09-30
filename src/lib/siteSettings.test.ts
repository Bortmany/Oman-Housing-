// Site-settings parsing tests. Run with: npm test
import { parseBoolSetting } from "./siteSettingsCore";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

// No row yet -> the default (free launch defaults ON).
expectEqual("missing.null", parseBoolSetting(null, true), true);
expectEqual("missing.undefined", parseBoolSetting(undefined, true), true);
expectEqual("true", parseBoolSetting("true", false), true);
expectEqual("false", parseBoolSetting("false", true), false);
// Garbage never flips a switch by accident.
expectEqual("garbage.keepsDefaultOn", parseBoolSetting("maybe", true), true);
expectEqual("garbage.keepsDefaultOff", parseBoolSetting("", false), false);

if (failures > 0) {
  console.error(`\n${failures} site-settings test(s) failed`);
  process.exit(1);
}
console.log("\nAll site-settings tests passed.");
