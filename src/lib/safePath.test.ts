// Open-redirect guard tests. Run with: npm test
import { safePath } from "./safePath";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

const FALLBACK = "/account";

// A normal in-app path is kept as-is.
expectEqual("plainPath.kept", safePath("/properties/abc123", FALLBACK), "/properties/abc123");
expectEqual("rootPath.kept", safePath("/", FALLBACK), "/");

// Missing/empty/non-string values fall back.
expectEqual("missing.fallsBack", safePath(undefined, FALLBACK), FALLBACK);
expectEqual("empty.fallsBack", safePath("", FALLBACK), FALLBACK);
expectEqual("notAPath.fallsBack", safePath("account", FALLBACK), FALLBACK);

// Absolute URLs to another host are rejected.
expectEqual("absoluteUrl.fallsBack", safePath("https://evil.com/phish", FALLBACK), FALLBACK);

// Protocol-relative ("//host") is rejected outright.
expectEqual("protocolRelative.fallsBack", safePath("//evil.com", FALLBACK), FALLBACK);

// The backslash bypass: browsers treat "\" the same as "/" when parsing a
// URL, so "/\evil.com" is navigated as "//evil.com" (a different host) even
// though the raw string doesn't start with "//".
expectEqual("backslashBypass.fallsBack", safePath("/\\evil.com", FALLBACK), FALLBACK);
expectEqual("backslashBypass.mixed.fallsBack", safePath("\\/evil.com", FALLBACK), FALLBACK);

// The tab-smuggled variant: browsers drop tab/newline/CR before parsing, so
// "/\t/evil.com" (a literal tab) also becomes "//evil.com".
expectEqual(
  "tabSmuggled.fallsBack",
  safePath("/\t/evil.com", FALLBACK),
  FALLBACK,
);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll safePath tests passed.");
