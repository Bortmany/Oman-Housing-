// ---------------------------------------------------------------------------
// Sign-up mode — who is allowed to create an account right now.
//
// Until payments exist the owner keeps the site invitation-only. Two env vars
// drive it (see .env.example):
//
//   SIGNUP_INVITE_CODES  comma-separated list of codes, each 8+ characters.
//                        Rotate a code by editing the variable and redeploying.
//   SIGNUPS_OPEN         "true" opens sign-up to everyone (the future switch
//                        once payments are live).
//
// Resolution (resolveSignupMode):
//   production        → "open" only if SIGNUPS_OPEN="true"
//                       else "invite" if at least one usable code exists
//                       else "closed" (safe default — nobody can sign up)
//   development/test  → "open" unless codes are set (so the existing local
//                       flow and tests keep working), "invite" when they are
//
// Pure functions, no "server-only" import, so `npm test` can run
// signupMode.test.ts under tsx. The two server actions (register and
// list-with-us) and /api/health are the only callers.
// ---------------------------------------------------------------------------
import { createHash, timingSafeEqual } from "crypto";

export type SignupMode = "open" | "invite" | "closed";

/** Codes shorter than this are ignored — too easy to guess. */
export const MIN_INVITE_CODE_LENGTH = 8;

/** The form field both sign-up forms post the code under. */
export const INVITE_CODE_FIELD = "inviteCode";

/** Wrong/missing codes per visitor before the sign-up forms stop checking. */
export const INVITE_ATTEMPT_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

export type SignupEnv = {
  SIGNUP_INVITE_CODES?: string;
  SIGNUPS_OPEN?: string;
  NODE_ENV?: string;
};

/**
 * Split the env value into usable codes: trimmed, non-empty, 8+ characters.
 * Never log the result — these are secrets.
 */
export function parseInviteCodes(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length >= MIN_INVITE_CODE_LENGTH);
}

export function resolveSignupMode(env: SignupEnv): SignupMode {
  const hasCodes = parseInviteCodes(env.SIGNUP_INVITE_CODES).length > 0;
  if (env.SIGNUPS_OPEN === "true") return "open";
  if (hasCodes) return "invite";
  return env.NODE_ENV === "production" ? "closed" : "open";
}

/** The live mode, read from the process environment. */
export function getSignupMode(): SignupMode {
  return resolveSignupMode(process.env);
}

/**
 * Does `submitted` match one of `codes`? Constant-time: every code is checked
 * (no early exit) and each comparison is a timingSafeEqual over SHA-256
 * digests, so neither the code length nor the position of the first
 * mismatching character leaks through response timing.
 */
export function isValidInviteCode(submitted: unknown, codes: string[]): boolean {
  if (typeof submitted !== "string") return false;
  const trimmed = submitted.trim();
  if (trimmed.length < MIN_INVITE_CODE_LENGTH) return false;
  const given = createHash("sha256").update(trimmed).digest();
  let matched = false;
  for (const code of codes) {
    const expected = createHash("sha256").update(code).digest();
    // Bitwise OR, not ||, so every code is compared regardless of outcome.
    matched = timingSafeEqual(given, expected) || matched;
  }
  return matched;
}

/** Check a submitted code against the live SIGNUP_INVITE_CODES. */
export function checkInviteCode(submitted: unknown): boolean {
  return isValidInviteCode(submitted, parseInviteCodes(process.env.SIGNUP_INVITE_CODES));
}
