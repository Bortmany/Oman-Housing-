// Enquiry-guard and contact-field tests. Run with: npm test
import { ENQUIRY_DAILY_CAP, evaluateEnquiry } from "./enquiry";
import {
  checkPhone,
  combinePhone,
  isPossibleEmail,
  splitPhone,
} from "./contact";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

// A bot that filled the hidden field is rejected regardless of count
expectEqual(
  "honeypot.filled",
  evaluateEnquiry({ honeypot: "http://spam", recentCount: 0 }),
  "honeypot",
);
expectEqual(
  "honeypot.whitespaceOnlyIsEmpty",
  evaluateEnquiry({ honeypot: "   ", recentCount: 0 }),
  "ok",
);

// Under the cap → ok; at/over the cap → rate limited
expectEqual("rate.underCap", evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP - 1 }), "ok");
expectEqual("rate.atCap", evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP }), "rateLimited");
expectEqual("rate.overCap", evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP + 3 }), "rateLimited");

// Honeypot takes priority over the rate check
expectEqual(
  "honeypot.beforeRate",
  evaluateEnquiry({ honeypot: "x", recentCount: ENQUIRY_DAILY_CAP + 10 }),
  "honeypot",
);

// ---------- Contact fields: impossible input must be refused ----------

// Omani numbers: exactly 8 digits, starting 9 or 7
expectEqual("phone.om.valid", checkPhone("+968", "9123 4567"), null);
expectEqual("phone.om.tooShort", checkPhone("+968", "565"), "tooShort");
expectEqual("phone.om.tooLong", checkPhone("+968", "912345678"), "tooLong");
expectEqual("phone.om.badPrefix", checkPhone("+968", "12345678"), "mobilePrefix");
expectEqual("phone.om.letters", checkPhone("+968", "9123abcd"), "digits");
// Arabic-Indic digits are accepted the same as Latin ones
expectEqual("phone.om.arabicDigits", checkPhone("+968", "٩١٢٣٤٥٦٧"), null);
// Typing the code into the box as well is forgiven, not rejected
expectEqual("phone.om.codeRepeated", checkPhone("+968", "+968 9123 4567"), null);
expectEqual(
  "phone.om.codeRepeated.stored",
  combinePhone("+968", "+968 9123 4567"),
  "+968 91234567",
);

// Per-country lengths: a doubled code or a local trunk zero is cleaned up, not
// stored twice (the "+971 971501234567" bug).
expectEqual("phone.ae.valid", checkPhone("+971", "50 123 4567"), null);
expectEqual("phone.ae.doubledCode", combinePhone("+971", "+971 50 123 4567"), "+971 501234567");
expectEqual("phone.ae.zeroPrefix", combinePhone("+971", "050 123 4567"), "+971 501234567");
expectEqual("phone.ae.intlPrefix", combinePhone("+971", "00971 50 123 4567"), "+971 501234567");
expectEqual("phone.ae.tooLong", checkPhone("+971", "50 123 45678"), "tooLong");
expectEqual("phone.sa.valid", checkPhone("+966", "512345678"), null);
expectEqual("phone.kw.eightDigits", checkPhone("+965", "50012345"), null);
expectEqual("phone.kw.nineDigits", checkPhone("+965", "500123456"), "tooLong");
// Yemeni mobiles are 9 digits (73x/77x/71x xxx xxx), not 8
expectEqual("phone.ye.nineDigits", checkPhone("+967", "73 123 4567"), null);
expectEqual("phone.ye.eightDigits", checkPhone("+967", "7312 3456"), "tooShort");
expectEqual("phone.in.tenDigits", checkPhone("+91", "98765 43210"), null);
expectEqual("phone.in.nineDigits", checkPhone("+91", "98765 4321"), "tooShort");
// USA/Canada numbers have no trunk zero — a leading 0 is not silently dropped
expectEqual("phone.us.noTrunkZero", checkPhone("+1", "0555 123 4567"), "tooLong");

// "Other" keeps an unlisted code working instead of locking the account out
expectEqual("phone.other.code.accepted", checkPhone("+", "998901234567"), null);
expectEqual("phone.other.code.asTyped", combinePhone("+", "998 90 123 4567"), "+998901234567");
expectEqual("phone.other.code.tooLong", checkPhone("+", "1234567890123456"), "tooLong");
expectEqual("phone.split.unlistedCode", splitPhone("+998 90 123 4567").dialCode, "+");
expectEqual("phone.split.unlistedNumber", splitPhone("+998 90 123 4567").number, "998 90 123 4567");

// USA/Canada: exactly 10 digits — a 14-digit number is refused
expectEqual("phone.us.valid", checkPhone("+1", "555 123 4567"), null);
expectEqual("phone.us.tooLong", checkPhone("+1", "5551234567 8901"), "tooLong");
// Any other code: a sane 6–12 digits
expectEqual("phone.gb.tooShort", checkPhone("+44", "12345"), "tooShort");
expectEqual("phone.gb.valid", checkPhone("+44", "7400 123456"), null);
expectEqual("phone.unknownCode", checkPhone("+999", "12345678"), "unknownCode");
// Empty is not this rule's business (the form decides if a phone is required)
expectEqual("phone.empty", checkPhone("+968", "  "), null);

// One combined string is stored, and splits back cleanly for edit forms
expectEqual("phone.combine", combinePhone("+968", "9123 4567"), "+968 91234567");
expectEqual("phone.combine.empty", combinePhone("+968", ""), null);
expectEqual("phone.split.code", splitPhone("+971 501234567").dialCode, "+971");
expectEqual("phone.split.number", splitPhone("+971 501234567").number, "501234567");
expectEqual("phone.split.legacy", splitPhone("91234567").dialCode, "+968");

// Emails must be shaped name@domain.tld — no provider whitelist
expectEqual("email.valid", isPossibleEmail("ahmed@example.com"), true);
expectEqual("email.business", isPossibleEmail("sales@al-mouj.om"), true);
expectEqual("email.noAt", isPossibleEmail("ahmed.example.com"), false);
expectEqual("email.noTld", isPossibleEmail("ahmed@example"), false);
expectEqual("email.trailingDot", isPossibleEmail("ahmed@example."), false);
expectEqual("email.spaces", isPossibleEmail("ahmed @example.com"), false);

if (failures > 0) {
  console.error(`\n${failures} enquiry test(s) failed`);
  process.exit(1);
}
console.log("\nAll enquiry tests passed.");
