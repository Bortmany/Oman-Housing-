// Tests for the "are alerts really live?" rule and the unsubscribe signature.
// Run with: npm test
import { alertsAreLive, isCronSecretValid } from "./live";
import {
  buildUnsubscribeUrl,
  signUnsubscribe,
  unsubscribeHeaders,
  verifyUnsubscribe,
} from "./unsubscribe";
import { buildAlertEmail } from "./template";
import { buildEml } from "../email/outbox";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const LONG = "a-long-enough-secret";
expectEqual("email on + secret: live", alertsAreLive("live", LONG), true);
expectEqual("local outbox + secret: live", alertsAreLive("outbox", LONG), true);
expectEqual("email on, no secret: NOT live", alertsAreLive("live", undefined), false);
expectEqual("email on, short secret: NOT live", alertsAreLive("live", "short"), false);
expectEqual("secret but email off: NOT live", alertsAreLive("off", LONG), false);
expectEqual("15 characters is too short, 16 is enough", [isCronSecretValid("x".repeat(15)), isCronSecretValid("x".repeat(16))], [false, true]);

// ---- unsubscribe signature ----
process.env.AUTH_SECRET = "test-auth-secret-for-unsubscribe";
const sig = signUnsubscribe("search-1");
expectEqual("valid signature passes", verifyUnsubscribe("search-1", sig), true);
expectEqual("signature for another search fails", verifyUnsubscribe("search-2", sig), false);
expectEqual("tampered signature fails", verifyUnsubscribe("search-1", sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0")), false);
expectEqual("empty / junk signature fails", [verifyUnsubscribe("search-1", ""), verifyUnsubscribe("search-1", "zz"), verifyUnsubscribe("", sig)], [false, false, false]);
expectEqual("signature made with another secret fails", verifyUnsubscribe("search-1", signUnsubscribe("search-1", "other-secret")), false);

const url = buildUnsubscribeUrl("https://example.test/", "search-1", "ar");
const parsed = new URL(url);
expectEqual("link points at the public route", parsed.pathname, "/api/alerts/unsubscribe");
expectEqual("link verifies", verifyUnsubscribe(parsed.searchParams.get("s")!, parsed.searchParams.get("t")!), true);
expectEqual("link carries the language", parsed.searchParams.get("lang"), "ar");

// ---- email carries the link and the headers ----
for (const locale of ["en", "ar"]) {
  const mail = buildAlertEmail({
    locale, name: "N", listings: [], totalNew: 0, baseUrl: "https://example.test", query: "", unsubscribeUrl: url,
  });
  expectEqual(`${locale}: text has the unsubscribe link`, mail.text.includes(url), true);
  expectEqual(`${locale}: html has the unsubscribe link`, mail.html.includes(url.replace(/&/g, "&amp;")), true);
}
const headers = unsubscribeHeaders(url);
expectEqual("one-click headers", [headers["List-Unsubscribe"], headers["List-Unsubscribe-Post"]], [`<${url}>`, "List-Unsubscribe=One-Click"]);
const eml = buildEml({ to: "a@example.test", subject: "s", text: "t", headers }, "b");
expectEqual("outbox .eml includes both headers", [eml.includes(`List-Unsubscribe: <${url}>`), eml.includes("List-Unsubscribe-Post: List-Unsubscribe=One-Click")], [true, true]);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll alert-live and unsubscribe tests passed.");
