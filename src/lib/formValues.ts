// Keeping what the visitor typed.
//
// React resets a form once its server action finishes, so a rejected submit
// used to hand back an empty form and the visitor had to retype everything.
// The fix: every action that can say "no" carries the submitted text back in
// its state, and the form feeds it to each box as `defaultValue`. Boxes the
// form already drives from React state (email, phone) keep their text on their
// own and need nothing here.
//
// A password is never carried back — it is retyped, always.

/** The text the visitor typed, keyed by input name. */
export type SubmittedValues = Record<string, string>;

/** Never echoed back to the browser, whatever a form chooses to call them. */
const SECRET_FIELDS = ["password", "newPassword", "currentPassword", "confirmPassword"];

/** Longest text we hand back (the longest box in the app is 5,000 characters). */
const MAX_ECHOED_LENGTH = 5000;

/**
 * Pick the named inputs out of a submitted form so the action can return them
 * with its error. Only plain text is taken (never uploaded files), passwords
 * are skipped, and over-long text is trimmed so a crafted POST cannot bloat
 * the reply.
 */
export function submittedValues(
  formData: FormData,
  names: readonly string[],
): SubmittedValues {
  const values: SubmittedValues = {};
  for (const name of names) {
    if (SECRET_FIELDS.includes(name)) continue;
    const value = formData.get(name);
    if (typeof value !== "string" || value === "") continue;
    values[name] = value.slice(0, MAX_ECHOED_LENGTH);
  }
  return values;
}

/**
 * What a box should show: the text the visitor typed on the failed attempt if
 * there is any, otherwise the form's own starting value.
 */
export function typedOr(
  values: SubmittedValues | undefined,
  name: string,
  fallback = "",
): string {
  return values?.[name] ?? fallback;
}
