// Tests for the typed-text-comes-back helper.
import { describe, expect, test } from "vitest";
import { submittedValues, typedOr } from "@/lib/formValues";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe("submittedValues", () => {
  test("what the visitor typed comes back, but a password never does", () => {
    const filled = form({
      name: "Ahmed Al Balushi",
      message: "Is this villa still available?",
      password: "hunter2secret",
    });
    const values = submittedValues(filled, ["name", "message", "password"]);
    expect(values.name).toBe("Ahmed Al Balushi");
    expect(values.message).toBe("Is this villa still available?");
    // …even when the form asks for it by name.
    expect("password" in values).toBe(false);
  });

  test("only the named boxes travel back, and empty ones are left out", () => {
    const partial = submittedValues(form({ name: "Sara", secretNote: "x", email: "" }), [
      "name",
      "email",
    ]);
    expect(Object.keys(partial).join(",")).toBe("name");
  });

  test("over-long text is trimmed so a crafted POST cannot bloat the reply", () => {
    const long = submittedValues(form({ message: "x".repeat(9000) }), ["message"]);
    expect(long.message.length).toBe(5000);
  });
});

describe("typedOr", () => {
  test("the box shows the typed text when there is any, otherwise its own default", () => {
    expect(typedOr({ name: "Sara" }, "name", "Ahmed")).toBe("Sara");
    expect(typedOr({}, "name", "Ahmed")).toBe("Ahmed");
    expect(typedOr(undefined, "name", "Ahmed")).toBe("Ahmed");
  });
});
