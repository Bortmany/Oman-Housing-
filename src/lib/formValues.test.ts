// Tests for the typed-text-comes-back helper. Run with: npm test
import { submittedValues, typedOr } from "./formValues";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

// What the visitor typed comes back…
const filled = form({
  name: "Ahmed Al Balushi",
  message: "Is this villa still available?",
  password: "hunter2secret",
});
const values = submittedValues(filled, ["name", "message", "password"]);
expectEqual("keeps.name", values.name, "Ahmed Al Balushi");
expectEqual("keeps.message", values.message, "Is this villa still available?");
// …but a password never does, even when the form asks for it by name.
expectEqual("password.neverEchoed", "password" in values, false);

// Only the named boxes travel back, and empty ones are left out.
const partial = submittedValues(form({ name: "Sara", secretNote: "x", email: "" }), [
  "name",
  "email",
]);
expectEqual("onlyNamedFields", Object.keys(partial).join(","), "name");

// Over-long text is trimmed so a crafted POST cannot bloat the reply.
const long = submittedValues(form({ message: "x".repeat(9000) }), ["message"]);
expectEqual("trimsOverlongText", long.message.length, 5000);

// The box shows the typed text when there is any, otherwise its own default.
expectEqual("typedOr.usesTyped", typedOr({ name: "Sara" }, "name", "Ahmed"), "Sara");
expectEqual("typedOr.usesFallback", typedOr({}, "name", "Ahmed"), "Ahmed");
expectEqual("typedOr.noValuesAtAll", typedOr(undefined, "name", "Ahmed"), "Ahmed");

if (failures > 0) {
  console.error(`\n${failures} form-value test(s) failed`);
  process.exit(1);
}
console.log("\nAll form-value tests passed.");
