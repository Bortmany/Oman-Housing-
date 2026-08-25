// Enquiry-guard and contact-field tests.
import { describe, expect, test } from "vitest";
import { ENQUIRY_DAILY_CAP, evaluateEnquiry } from "@/lib/enquiry";
import {
  checkPhone,
  combinePhone,
  isPossibleEmail,
  splitPhone,
} from "@/lib/contact";

describe("evaluateEnquiry", () => {
  test("a bot that filled the hidden field is rejected regardless of count", () => {
    expect(evaluateEnquiry({ honeypot: "http://spam", recentCount: 0 })).toBe("honeypot");
  });

  test("whitespace-only honeypot is treated as empty", () => {
    expect(evaluateEnquiry({ honeypot: "   ", recentCount: 0 })).toBe("ok");
  });

  test("under the cap is ok; at/over the cap is rate limited", () => {
    expect(evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP - 1 })).toBe("ok");
    expect(evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP })).toBe("rateLimited");
    expect(evaluateEnquiry({ honeypot: "", recentCount: ENQUIRY_DAILY_CAP + 3 })).toBe("rateLimited");
  });

  test("honeypot takes priority over the rate check", () => {
    expect(evaluateEnquiry({ honeypot: "x", recentCount: ENQUIRY_DAILY_CAP + 10 })).toBe("honeypot");
  });
});

describe("checkPhone / combinePhone / splitPhone — impossible input must be refused", () => {
  test("Omani numbers: exactly 8 digits, starting 9 or 7", () => {
    expect(checkPhone("+968", "9123 4567")).toBeNull();
    expect(checkPhone("+968", "565")).toBe("tooShort");
    expect(checkPhone("+968", "912345678")).toBe("tooLong");
    expect(checkPhone("+968", "12345678")).toBe("mobilePrefix");
    expect(checkPhone("+968", "9123abcd")).toBe("digits");
  });

  test("Arabic-Indic digits are accepted the same as Latin ones", () => {
    expect(checkPhone("+968", "٩١٢٣٤٥٦٧")).toBeNull();
  });

  test("typing the code into the box as well is forgiven, not rejected", () => {
    expect(checkPhone("+968", "+968 9123 4567")).toBeNull();
    expect(combinePhone("+968", "+968 9123 4567")).toBe("+968 91234567");
  });

  test("per-country lengths: a doubled code or a local trunk zero is cleaned up, not stored twice", () => {
    // the "+971 971501234567" bug
    expect(checkPhone("+971", "50 123 4567")).toBeNull();
    expect(combinePhone("+971", "+971 50 123 4567")).toBe("+971 501234567");
    expect(combinePhone("+971", "050 123 4567")).toBe("+971 501234567");
    expect(combinePhone("+971", "00971 50 123 4567")).toBe("+971 501234567");
    expect(checkPhone("+971", "50 123 45678")).toBe("tooLong");
    expect(checkPhone("+966", "512345678")).toBeNull();
    expect(checkPhone("+965", "50012345")).toBeNull();
    expect(checkPhone("+965", "500123456")).toBe("tooLong");
  });

  test("Yemeni mobiles are 9 digits (73x/77x/71x xxx xxx), not 8", () => {
    expect(checkPhone("+967", "73 123 4567")).toBeNull();
    expect(checkPhone("+967", "7312 3456")).toBe("tooShort");
  });

  test("India: 10 digits", () => {
    expect(checkPhone("+91", "98765 43210")).toBeNull();
    expect(checkPhone("+91", "98765 4321")).toBe("tooShort");
  });

  test("USA/Canada numbers have no trunk zero — a leading 0 is not silently dropped", () => {
    expect(checkPhone("+1", "0555 123 4567")).toBe("tooLong");
  });

  test('"Other" keeps an unlisted code working instead of locking the account out', () => {
    expect(checkPhone("+", "998901234567")).toBeNull();
    expect(combinePhone("+", "998 90 123 4567")).toBe("+998901234567");
    expect(checkPhone("+", "1234567890123456")).toBe("tooLong");
    expect(splitPhone("+998 90 123 4567").dialCode).toBe("+");
    expect(splitPhone("+998 90 123 4567").number).toBe("998 90 123 4567");
  });

  test("USA/Canada: exactly 10 digits — a 14-digit number is refused", () => {
    expect(checkPhone("+1", "555 123 4567")).toBeNull();
    expect(checkPhone("+1", "5551234567 8901")).toBe("tooLong");
  });

  test("any other code: a sane 6–12 digits", () => {
    expect(checkPhone("+44", "12345")).toBe("tooShort");
    expect(checkPhone("+44", "7400 123456")).toBeNull();
    expect(checkPhone("+999", "12345678")).toBe("unknownCode");
  });

  test("empty is not this rule's business (the form decides if a phone is required)", () => {
    expect(checkPhone("+968", "  ")).toBeNull();
  });

  test("one combined string is stored, and splits back cleanly for edit forms", () => {
    expect(combinePhone("+968", "9123 4567")).toBe("+968 91234567");
    expect(combinePhone("+968", "")).toBeNull();
    expect(splitPhone("+971 501234567").dialCode).toBe("+971");
    expect(splitPhone("+971 501234567").number).toBe("501234567");
    expect(splitPhone("91234567").dialCode).toBe("+968");
  });
});

describe("isPossibleEmail", () => {
  test("emails must be shaped name@domain.tld — no provider whitelist", () => {
    expect(isPossibleEmail("ahmed@example.com")).toBe(true);
    expect(isPossibleEmail("sales@al-mouj.om")).toBe(true);
    expect(isPossibleEmail("ahmed.example.com")).toBe(false);
    expect(isPossibleEmail("ahmed@example")).toBe(false);
    expect(isPossibleEmail("ahmed@example.")).toBe(false);
    expect(isPossibleEmail("ahmed @example.com")).toBe(false);
  });
});
