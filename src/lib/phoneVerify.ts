import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { checkPhone, normalizePhone } from "./contact";

// ---------------------------------------------------------------------------
// Owner phone verification — the rules, as pure functions (no database, no
// network), so they are tested in phoneVerify.test.ts. The screens and actions
// live in src/app/[locale]/(app)/account/listings/verify-phone/; the SMS
// provider connection lives in src/lib/sms/send.ts.
//
// OUR rules always run, whichever way the text is sent:
//   - Omani +968 mobiles only (8 digits starting 7 or 9)
//   - a code works for 10 minutes
//   - 5 wrong tries void the code
//   - 60 seconds between sends
//   - one verified number belongs to one account (checked against the database
//     in the action)
// ---------------------------------------------------------------------------

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

export type ParsedOmaniMobile = {
  /** The form we store in User.phone: "+968 91234567" (same as combinePhone). */
  stored: string;
  /** What the SMS provider wants: "+96891234567". */
  e164: string;
  /** The 8 national digits, e.g. "91234567". */
  digits: string;
};

/** Accepts "9123 4567", "+968 9123 4567", "0096891234567", Arabic-Indic digits. */
export function parseOmaniMobile(raw: string): ParsedOmaniMobile | null {
  if (checkPhone("+968", raw) !== null) return null;
  const digits = normalizePhone("+968", raw);
  if (!/^[79]\d{7}$/.test(digits)) return null;
  return { stored: `+968 ${digits}`, e164: `+968${digits}`, digits };
}

/** "+968 91234567" -> "+968 •••• 4567" — what we show back on screen. */
export function maskPhone(stored: string | null | undefined): string {
  const digits = String(stored ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  const national = digits.startsWith("968") ? digits.slice(3) : digits;
  return `+968 •••• ${national.slice(-4)}`;
}

/** The provider form ("+96891234567") of a stored "+968 91234567". */
export function toE164(stored: string): string {
  return `+${stored.replace(/\D/g, "")}`;
}

/** Latin digits only, from whatever the visitor typed (Arabic-Indic digits too). */
export function normalizeCode(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

export function isWellFormedCode(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

/** Cryptographically random 6-digit code (leading zeros kept). */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Keyed hash of a code. It covers the user and the number, so a code can't be
 * replayed for a different number or account. Key = AUTH_SECRET.
 */
export function hashCode(input: {
  userId: string;
  phone: string; // e164
  code: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.userId}|${input.phone}|${input.code}`)
    .digest("hex");
}

/** Constant-time comparison of two hex hashes. */
export function hashesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Seconds still to wait before another text may be sent (0 = go ahead). */
export function cooldownSecondsLeft(
  sentAt: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!sentAt) return 0;
  const left = RESEND_COOLDOWN_SECONDS - (now.getTime() - sentAt.getTime()) / 1000;
  return left > 0 ? Math.ceil(left) : 0;
}

export function codeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + CODE_TTL_MS);
}

export type CodeState = "none" | "active" | "expired" | "locked";

/**
 * Where a user's current code stands. "locked" = 5 wrong tries used;
 * "expired" = time ran out or the code was voided; "none" = nothing sent.
 */
export function codeState(
  user: {
    phoneVerifyPending: string | null;
    phoneVerifyExpiresAt: Date | null;
    phoneVerifyAttempts: number;
  },
  now: Date = new Date(),
): CodeState {
  if (!user.phoneVerifyPending) return "none";
  if (user.phoneVerifyAttempts >= MAX_ATTEMPTS) return "locked";
  if (!user.phoneVerifyExpiresAt || user.phoneVerifyExpiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

export function triesLeft(attempts: number): number {
  return Math.max(0, MAX_ATTEMPTS - attempts);
}

export type CheckOutcome =
  | { result: "verified" }
  | { result: "wrong"; attempts: number; triesLeft: number }
  | { result: "locked"; attempts: number }
  | { result: "expired" };

/**
 * Decide what a submitted code means, given the current state and whether it
 * matched (`matches` is true when the code is right — computed by the caller,
 * from our hash or from the SMS provider's check). A fifth wrong try voids the
 * code ("locked").
 */
export function decideCheck(
  state: CodeState,
  attempts: number,
  matches: boolean,
): CheckOutcome {
  if (state === "none" || state === "expired") return { result: "expired" };
  if (state === "locked") return { result: "locked", attempts };
  if (matches) return { result: "verified" };
  const next = attempts + 1;
  if (next >= MAX_ATTEMPTS) return { result: "locked", attempts: next };
  return { result: "wrong", attempts: next, triesLeft: triesLeft(next) };
}

// --- What the owner-listing part of the app asks -----------------------------

/**
 * True when this account has an Omani number confirmed by code. Part 2 (owner
 * listings) uses this to decide whether the user may add a listing.
 */
export function isPhoneVerified(
  user: { phone: string | null; phoneVerifiedAt: Date | null } | null | undefined,
): boolean {
  return Boolean(user && user.phone && user.phoneVerifiedAt);
}

/** The verified number ("+968 91234567"), or null when there isn't one. */
export function verifiedPhoneOf(
  user: { phone: string | null; phoneVerifiedAt: Date | null } | null | undefined,
): string | null {
  return isPhoneVerified(user) ? (user!.phone as string) : null;
}

// --- How a code gets sent ------------------------------------------------------

export type SmsMode = "twilio" | "dev" | "closed";

/**
 * "twilio" — all three Twilio Verify settings are present: Twilio makes and
 *            checks the code.
 * "dev"    — no keys, not production: we make the code, store only its hash,
 *            and print it to the server console.
 * "closed" — no keys in production: phone verification (and so owner
 *            listing) is switched off. Fails closed.
 */
export function resolveSmsMode(env: {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_VERIFY_SERVICE_SID?: string;
  NODE_ENV?: string;
}): SmsMode {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID) {
    return "twilio";
  }
  return env.NODE_ENV === "production" ? "closed" : "dev";
}
