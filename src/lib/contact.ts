// Contact-field rules shared by the forms (client-side, while the user is still
// typing) and by the server actions (re-checked, never trusting the browser).
// Pure functions, no I/O — covered by enquiry.test.ts.

/** Oman is pre-selected everywhere; the user can change it. */
export const DEFAULT_DIAL_CODE = "+968";

/**
 * The catch-all option: a number already stored with a code we don't list (say
 * "+998 …") keeps working — the user picks "Other" and we take the digits as
 * typed. Never let our short list lock anyone out of their own account.
 */
export const OTHER_DIAL_CODE = "+";

/**
 * The codes offered in the phone dropdown: the Gulf first (our market), then
 * the countries most of Oman's residents and overseas buyers call from, and
 * "Other" last. `key` points at the country name in the message dictionaries
 * (`contact.countries.*` in messages/en.json + ar.json).
 */
export const DIAL_CODES = [
  { code: "+968", key: "OM" },
  { code: "+971", key: "AE" },
  { code: "+966", key: "SA" },
  { code: "+965", key: "KW" },
  { code: "+974", key: "QA" },
  { code: "+973", key: "BH" },
  { code: "+967", key: "YE" },
  { code: "+91", key: "IN" },
  { code: "+92", key: "PK" },
  { code: "+880", key: "BD" },
  { code: "+94", key: "LK" },
  { code: "+63", key: "PH" },
  { code: "+20", key: "EG" },
  { code: "+962", key: "JO" },
  { code: "+44", key: "GB" },
  { code: "+1", key: "US" },
  { code: OTHER_DIAL_CODE, key: "OTHER" },
] as const;

export type DialCodeKey = (typeof DIAL_CODES)[number]["key"];

export function isKnownDialCode(value: string): boolean {
  return DIAL_CODES.some((c) => c.code === value);
}

/** How many digits a number can have for a code, and (Oman) how it may start. */
type PhoneRule = { min: number; max: number; startsWith?: readonly string[] };

const PHONE_RULES: Record<string, PhoneRule> = {
  "+968": { min: 8, max: 8, startsWith: ["7", "9"] }, // Omani mobiles
  "+971": { min: 9, max: 9 }, // UAE
  "+966": { min: 9, max: 9 }, // Saudi Arabia
  "+965": { min: 8, max: 8 }, // Kuwait
  "+974": { min: 8, max: 8 }, // Qatar
  "+973": { min: 8, max: 8 }, // Bahrain
  "+967": { min: 9, max: 9 }, // Yemen (mobiles are 73x/77x/71x xxx xxx)
  "+91": { min: 10, max: 10 }, // India
  "+1": { min: 10, max: 10 }, // USA / Canada
  // "Other": we don't know the country's rule, so only a sane overall length.
  [OTHER_DIAL_CODE]: { min: 6, max: 15 },
};
/** Anything else: a sane 6–12 digits. */
const DEFAULT_PHONE_RULE: PhoneRule = { min: 6, max: 12 };

export function phoneRule(dialCode: string): PhoneRule {
  return PHONE_RULES[dialCode] ?? DEFAULT_PHONE_RULE;
}

/** Punctuation people put in phone numbers, all of it meaningless to us. */
const PHONE_PUNCTUATION = "  ‎‏-–—().+/";

/** Latin digits out of Latin, Arabic-Indic (٠١٢) or Persian (۰۱۲) input. */
function toLatinDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (PHONE_PUNCTUATION.includes(ch)) continue;
    else out += ch;
  }
  return out;
}

function fitsRule(dialCode: string, digits: string): boolean {
  const rule = phoneRule(dialCode);
  if (digits.length < rule.min || digits.length > rule.max) return false;
  if (rule.startsWith && !rule.startsWith.includes(digits[0])) return false;
  return true;
}

/** Drop one leading trunk "0" — how people write numbers inside their country. */
function withoutTrunkZero(digits: string): string | null {
  return digits.startsWith("0") ? digits.slice(1) : null;
}

/**
 * The digits we actually store: spaces/dashes stripped, Arabic digits converted.
 * Forgiving about the two things people habitually type into the number box —
 * the country code again ("+971 50 123 4567" with UAE selected) and the local
 * trunk zero ("050 123 4567") — but only when dropping them turns an impossible
 * number into a possible one, so a valid number is never mangled. With "Other"
 * selected we don't know the country's habits, so the digits stay as typed.
 */
export function normalizePhone(dialCode: string, raw: string): string {
  const cleaned = toLatinDigits(raw.trim());
  if (!/^\d+$/.test(cleaned)) return cleaned; // let checkPhone report it
  if (dialCode === OTHER_DIAL_CODE) return cleaned;
  if (fitsRule(dialCode, cleaned)) return cleaned; // already possible: leave it

  const codeDigits = dialCode.replace(/\D/g, "");
  const candidates: string[] = [];
  const withoutCode: string[] = [];
  for (const prefix of [`00${codeDigits}`, codeDigits]) {
    if (prefix !== "" && cleaned.startsWith(prefix)) {
      withoutCode.push(cleaned.slice(prefix.length));
    }
  }
  candidates.push(...withoutCode);
  // USA/Canada numbers have no trunk zero, so never strip one there.
  if (dialCode !== "+1") {
    for (const value of [cleaned, ...withoutCode]) {
      const trimmed = withoutTrunkZero(value);
      if (trimmed !== null) candidates.push(trimmed);
    }
  }
  return candidates.find((c) => fitsRule(dialCode, c)) ?? cleaned;
}

export type PhoneProblem =
  | "unknownCode"
  | "digits"
  | "tooShort"
  | "tooLong"
  | "mobilePrefix";

/**
 * Is this number possible for the selected country code? Returns the problem, or
 * null when the number is fine — an empty number is "fine" here, because whether
 * a phone is required is the form's decision, not this rule's.
 */
export function checkPhone(dialCode: string, raw: string): PhoneProblem | null {
  if (!isKnownDialCode(dialCode)) return "unknownCode";
  const digits = normalizePhone(dialCode, raw);
  if (digits === "") return null;
  if (!/^\d+$/.test(digits)) return "digits";
  const rule = phoneRule(dialCode);
  if (digits.length < rule.min) return "tooShort";
  if (digits.length > rule.max) return "tooLong";
  if (rule.startsWith && !rule.startsWith.includes(digits[0])) {
    return "mobilePrefix";
  }
  return null;
}

/**
 * The one string we store in the existing `phone` column — code and number
 * together, e.g. "+968 91234567". No schema change: the dropdown is a UI aid.
 * Returns null for an empty number.
 */
export function combinePhone(dialCode: string, raw: string): string | null {
  const digits = normalizePhone(dialCode, raw);
  if (digits === "") return null;
  // "Other" already is the plus sign, so no space in between: "+998901234567".
  if (dialCode === OTHER_DIAL_CODE) return `${OTHER_DIAL_CODE}${digits}`;
  return `${dialCode} ${digits}`;
}

/**
 * Split a stored value back into dropdown + box (for edit forms). A number
 * saved with a code we don't list still opens: the longest-match search falls
 * through to "Other" (`+`) and shows the rest of the digits untouched.
 */
export function splitPhone(stored: string | null | undefined): {
  dialCode: string;
  number: string;
} {
  const value = (stored ?? "").trim();
  if (value === "") return { dialCode: DEFAULT_DIAL_CODE, number: "" };
  // Longest match first, so "+968" wins over "+9…" style overlaps and "+" is
  // only ever the last resort.
  const match = DIAL_CODES.map((c) => c.code)
    .filter((code) => value.startsWith(code))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return { dialCode: match, number: value.slice(match.length).trim() };
  return { dialCode: DEFAULT_DIAL_CODE, number: value };
}

/** The greyed-out example shown in the box, in the local format for the code. */
const PHONE_EXAMPLES: Record<string, string> = {
  "+968": "9123 4567",
  "+971": "50 123 4567",
  "+966": "50 123 4567",
  "+965": "500 12345",
  "+974": "3312 3456",
  "+973": "3600 1234",
  "+44": "7400 123456",
  "+1": "555 123 4567",
  "+91": "98765 43210",
  // With "Other" the country code goes in the box too.
  [OTHER_DIAL_CODE]: "44 7400 123456",
};

export function phoneExample(dialCode: string): string {
  return PHONE_EXAMPLES[dialCode] ?? "12 345 678";
}

/**
 * A real-looking address: something before the @, a domain, and a dot-ending.
 * Deliberately NOT a provider whitelist — business addresses must work.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export function isPossibleEmail(raw: string): boolean {
  const value = raw.trim();
  return value.length <= 200 && EMAIL_SHAPE.test(value);
}
