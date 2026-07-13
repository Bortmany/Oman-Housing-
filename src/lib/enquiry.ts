// Pure enquiry guards — no I/O. The daily count is fetched by the server action;
// everything here is deterministic so it can be unit-tested (enquiry.test.ts).

export const ENQUIRY_DAILY_CAP = 5; // per email address, rolling 24h
export const ENQUIRY_WINDOW_MS = 24 * 3600 * 1000;
export const MAX_MESSAGE_LENGTH = 1000;

export type EnquiryVerdict = "ok" | "honeypot" | "rateLimited";

/**
 * Decide whether to accept an enquiry, given the hidden honeypot field's value
 * (bots fill it; humans never see it) and how many the email has sent in the
 * window. Kept separate from the DB call so it is trivially testable.
 */
export function evaluateEnquiry(input: {
  honeypot: string;
  recentCount: number;
}): EnquiryVerdict {
  if (input.honeypot.trim() !== "") return "honeypot";
  if (input.recentCount >= ENQUIRY_DAILY_CAP) return "rateLimited";
  return "ok";
}
