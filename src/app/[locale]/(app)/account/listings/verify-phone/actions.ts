"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { claimCodeTry } from "@/lib/phoneAttempts";
import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  codeExpiry,
  codeState,
  cooldownSecondsLeft,
  decideCheck,
  generateCode,
  hashCode,
  hashesMatch,
  isPhoneVerified,
  isWellFormedCode,
  maskPhone,
  normalizeCode,
  parseOmaniMobile,
  toE164,
  triesLeft,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/phoneVerify";
import {
  checkVerificationCode,
  getSmsMode,
  sendVerificationCode,
} from "@/lib/sms/send";

// Phone-code verification for owners. One action, four intents:
//   send    — first text, to the number typed in the box
//   resend  — a new code to the number already being checked
//   confirm — check the 6 digits
//   change  — forget the number being checked and go back to step 1
// Every intent checks the signed-in user first and only touches that user's row.

export type VerifyErrorKey =
  | "wrongCode"
  | "expired"
  | "tooManyTries"
  | "rateLimited"
  | "invalidPhone"
  | "phoneInUse"
  | "sendFailed"
  | "notAvailable"
  | "wait";

export type VerifyState = {
  step: "phone" | "code" | "done";
  /** "+968 •••• 4567" — the full number is never sent back to the browser. */
  masked?: string;
  error?: VerifyErrorKey;
  /** Seconds before another text may be requested. */
  resendIn?: number;
  triesLeft?: number;
  /** True right after a resend, for the green "New code sent." line. */
  resent?: boolean;
  /** Changes on every response so the screen can restart its countdown. */
  nonce: number;
} | null;

const HOUR = 60 * 60 * 1000;

function now() {
  return new Date();
}

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "";
}

export async function verifyPhoneAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const session = await auth();
  if (!session?.user?.id) return null; // the (app) layout already sends visitors to sign in
  const userId = session.user.id;
  const nonce = Date.now();
  const intent = String(formData.get("intent") ?? "");

  const mode = getSmsMode();
  if (mode === "closed") return { step: "phone", error: "notAvailable", nonce };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phone: true,
      phoneVerifiedAt: true,
      phoneVerifyPending: true,
      phoneVerifyCodeHash: true,
      phoneVerifyExpiresAt: true,
      phoneVerifyAttempts: true,
      phoneVerifySentAt: true,
    },
  });
  if (!user) return null;

  // --- change number -------------------------------------------------------
  if (intent === "change") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerifyPending: null,
        phoneVerifyCodeHash: null,
        phoneVerifyExpiresAt: null,
        phoneVerifyAttempts: 0,
      },
    });
    return { step: "phone", nonce };
  }

  // --- send / resend -------------------------------------------------------
  if (intent === "send" || intent === "resend") {
    let stored: string;
    if (intent === "resend") {
      if (!user.phoneVerifyPending) return { step: "phone", nonce };
      stored = user.phoneVerifyPending;
    } else {
      const parsed = parseOmaniMobile(String(formData.get("phone") ?? ""));
      if (!parsed) return { step: "phone", error: "invalidPhone", nonce };
      stored = parsed.stored;
    }
    const e164 = toE164(stored);
    const errorStep = intent === "resend" ? "code" : "phone";
    const masked = maskPhone(stored);

    // Already verified on this very number: nothing to do.
    if (isPhoneVerified(user) && user.phone === stored) {
      return { step: "done", masked, nonce };
    }

    // 60 seconds between texts (checked first, so a refused click costs nothing).
    const wait = cooldownSecondsLeft(user.phoneVerifySentAt, now());
    if (wait > 0) {
      return { step: errorStep, masked, error: "wait", resendIn: wait, nonce };
    }

    // Money guard, applied BEFORE we look at anyone else's data: 3 texts an
    // hour per account, 10 per network address, and 3 per account-and-number
    // pair. The number's limit is per sender on purpose, so a stranger typing
    // someone's number cannot use up that owner's own sends.
    const ip = getClientIp(await headers());
    const perUser = checkRateLimit(`owner:sms:send:user:${userId}`, { limit: 3, windowMs: HOUR });
    const perIp = checkRateLimit(`owner:sms:send:ip:${ip}`, { limit: 10, windowMs: HOUR });
    const perPair = checkRateLimit(`owner:sms:send:pair:${userId}:${e164}`, { limit: 3, windowMs: HOUR });
    if (!perUser.allowed || !perIp.allowed || !perPair.allowed) {
      return { step: errorStep, masked, error: "rateLimited", resendIn: wait, nonce };
    }

    // One verified number belongs to one account. We do NOT say so here: the
    // answer looks exactly like "code sent" (so nobody can probe which numbers
    // are taken), but no text goes out and no usable code is kept. The refusal
    // comes at the confirm step, in neutral words.
    const taken = await prisma.user.findFirst({
      where: { phone: stored, phoneVerifiedAt: { not: null }, id: { not: userId } },
      select: { id: true },
    });

    let codeHash: string | null = null;
    if (taken) {
      // Nothing is sent and no code exists: any code typed later will fail.
    } else if (mode === "twilio") {
      const sent = await sendVerificationCode(e164);
      if (sent.status !== "sent") {
        return { step: errorStep, masked, error: "sendFailed", nonce };
      }
    } else {
      // Development only (mode "dev" never exists in production): we make the
      // code, keep only its hash, and print it where the developer can read it.
      const code = generateCode();
      codeHash = hashCode({ userId, phone: e164, code, secret: authSecret() });
      console.info(`[dev] Phone code for ${masked}: ${code}`);
    }

    const sentAt = now();
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerifyPending: stored,
        phoneVerifyCodeHash: codeHash,
        phoneVerifyExpiresAt: codeExpiry(sentAt),
        phoneVerifyAttempts: 0,
        phoneVerifySentAt: sentAt,
      },
    });
    return {
      step: "code",
      masked,
      resendIn: RESEND_COOLDOWN_SECONDS,
      resent: intent === "resend",
      nonce,
    };
  }

  // --- confirm ---------------------------------------------------------------
  if (intent === "confirm") {
    const pending = user.phoneVerifyPending;
    if (!pending) return { step: "phone", nonce };
    const masked = maskPhone(pending);
    const e164 = toE164(pending);
    const wait = cooldownSecondsLeft(user.phoneVerifySentAt, now());

    // Flood guard on top of the 5-wrong-tries rule.
    const flood = checkRateLimit(`owner:sms:check:user:${userId}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (!flood.allowed) {
      return { step: "code", masked, error: "rateLimited", resendIn: wait, nonce };
    }

    // This is where "number can't be used" is told (never at send time).
    const inUse = await prisma.user.findFirst({
      where: { phone: pending, phoneVerifiedAt: { not: null }, id: { not: userId } },
      select: { id: true },
    });
    if (inUse) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          phoneVerifyPending: null,
          phoneVerifyCodeHash: null,
          phoneVerifyExpiresAt: null,
          phoneVerifyAttempts: 0,
        },
      });
      return { step: "phone", error: "phoneInUse", nonce };
    }

    const code = normalizeCode(String(formData.get("code") ?? ""));
    const state = codeState(user, now());
    let attemptsBefore = user.phoneVerifyAttempts;

    // Is it the right code? (Only worth asking when our own rules allow a try.)
    let matches = false;
    let providerExpired = false;
    if (state === "active") {
      if (!isWellFormedCode(code)) {
        // Not even six digits: say "wrong" but don't burn a try on a typo.
        return {
          step: "code",
          masked,
          error: "wrongCode",
          resendIn: wait,
          triesLeft: triesLeft(user.phoneVerifyAttempts),
          nonce,
        };
      }
      // Claim one of the 5 tries in a single database step BEFORE checking, so
      // many parallel guesses cannot all slip in under the limit.
      const before = await claimCodeTry(userId, pending);
      if (before === null) {
        return { step: "code", masked, error: "tooManyTries", resendIn: wait, nonce };
      }
      attemptsBefore = before;
      if (getSmsMode() === "twilio") {
        const checked = await checkVerificationCode(e164, code);
        if (checked.status === "failed" || checked.status === "not-configured") {
          // Our fault, not the visitor's: give the try back.
          await prisma.user.updateMany({
            where: { id: userId, phoneVerifyAttempts: { gt: 0 } },
            data: { phoneVerifyAttempts: { decrement: 1 } },
          });
          return { step: "code", masked, error: "sendFailed", resendIn: wait, nonce };
        }
        matches = checked.status === "approved";
        providerExpired = checked.status === "expired";
      } else if (user.phoneVerifyCodeHash) {
        matches = hashesMatch(
          user.phoneVerifyCodeHash,
          hashCode({ userId, phone: e164, code, secret: authSecret() }),
        );
      }
    }

    const outcome = providerExpired
      ? ({ result: "expired" } as const)
      : decideCheck(state, attemptsBefore, matches);

    if (outcome.result === "verified") {
      // Re-check the one-number-one-account rule at the last moment.
      const taken = await prisma.user.findFirst({
        where: { phone: pending, phoneVerifiedAt: { not: null }, id: { not: userId } },
        select: { id: true },
      });
      if (taken) return { step: "phone", error: "phoneInUse", nonce };
      await prisma.user.update({
        where: { id: userId },
        data: {
          phone: pending,
          phoneVerifiedAt: now(),
          phoneVerifyPending: null,
          phoneVerifyCodeHash: null,
          phoneVerifyExpiresAt: null,
          phoneVerifyAttempts: 0,
        },
      });
      return { step: "done", masked, nonce };
    }

    if (outcome.result === "wrong") {
      // The try was already counted when we claimed it above.
      return {
        step: "code",
        masked,
        error: "wrongCode",
        triesLeft: outcome.triesLeft,
        resendIn: wait,
        nonce,
      };
    }

    if (outcome.result === "locked") {
      // Void the code: nothing left to guess at.
      await prisma.user.update({
        where: { id: userId },
        data: {
          phoneVerifyAttempts: outcome.attempts,
          phoneVerifyCodeHash: null,
          phoneVerifyExpiresAt: null,
        },
      });
      return { step: "code", masked, error: "tooManyTries", resendIn: wait, nonce };
    }

    return { step: "code", masked, error: "expired", resendIn: wait, nonce };
  }

  return null;
}
