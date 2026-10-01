import "server-only";
import { logger } from "@/lib/logger";
import { resolveSmsMode, type SmsMode } from "@/lib/phoneVerify";

// ---------------------------------------------------------------------------
// Phone codes by text message — the wiring, DORMANT until the owner connects
// Twilio Verify. Same idea as src/lib/email/send.ts: never throws, returns a
// plain result, and logs no secrets or phone numbers.
//
// Set ALL THREE of TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_VERIFY_SERVICE_SID and Twilio Verify makes the code, texts it and
// checks it (plain fetch, no SDK, no new dependency). The site's own rules
// (Omani mobiles only, 10 minutes, 5 tries, 60 s between sends, one account
// per number) still run in front of it — see src/lib/phoneVerify.ts.
//
// Without keys: development makes the code itself and prints it to the server
// console (the action does that); production is closed. See GO-LIVE.md.
// ---------------------------------------------------------------------------

const VERIFY_BASE = "https://verify.twilio.com/v2/Services";
const TIMEOUT_MS = 10_000;

export type SendCodeResult =
  | { status: "sent" }
  | { status: "not-configured" }
  | { status: "failed"; reason: string };

export type CheckCodeResult =
  | { status: "approved" }
  | { status: "rejected" } // wrong code
  | { status: "expired" } // Twilio has no live code for this number
  | { status: "not-configured" }
  | { status: "failed"; reason: string };

/** "twilio" | "dev" | "closed" — see resolveSmsMode. */
export function getSmsMode(): SmsMode {
  return resolveSmsMode(process.env);
}

/** True when Twilio Verify is connected (all three settings present). */
export function isSmsConfigured(): boolean {
  return getSmsMode() === "twilio";
}

/** False only in production with no Twilio keys: owner listing stays closed. */
export function isPhoneVerificationAvailable(): boolean {
  return getSmsMode() !== "closed";
}

function credentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !service) return null;
  return {
    service,
    auth: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
  };
}

async function postForm(
  creds: NonNullable<ReturnType<typeof credentials>>,
  path: string,
  fields: Record<string, string>,
) {
  return fetch(`${VERIFY_BASE}/${creds.service}/${path}`, {
    method: "POST",
    headers: {
      Authorization: creds.auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Ask Twilio Verify to text a fresh code to `e164` ("+96891234567"). */
export async function sendVerificationCode(e164: string): Promise<SendCodeResult> {
  const creds = credentials();
  if (!creds) return { status: "not-configured" };
  try {
    const response = await postForm(creds, "Verifications", { To: e164, Channel: "sms" });
    if (!response.ok) {
      // Status only — Twilio's error body can echo the number back.
      logger.warn("sms.send.rejected", { status: response.status });
      return { status: "failed", reason: `http_${response.status}` };
    }
    return { status: "sent" };
  } catch (err) {
    logger.warn("sms.send.error", { name: err instanceof Error ? err.name : "unknown" });
    return { status: "failed", reason: "network" };
  }
}

/** Ask Twilio Verify whether `code` is the right one for `e164`. */
export async function checkVerificationCode(
  e164: string,
  code: string,
): Promise<CheckCodeResult> {
  const creds = credentials();
  if (!creds) return { status: "not-configured" };
  try {
    const response = await postForm(creds, "VerificationCheck", { To: e164, Code: code });
    if (response.status === 404) return { status: "expired" };
    if (!response.ok) {
      logger.warn("sms.check.rejected", { status: response.status });
      return { status: "failed", reason: `http_${response.status}` };
    }
    const body = (await response.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "approved" ? { status: "approved" } : { status: "rejected" };
  } catch (err) {
    logger.warn("sms.check.error", { name: err instanceof Error ? err.name : "unknown" });
    return { status: "failed", reason: "network" };
  }
}
