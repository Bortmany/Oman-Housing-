import "server-only";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Sending email — the wiring, switched OFF until the owner connects a provider.
//
// Set RESEND_API_KEY and EMAIL_FROM in the environment and this starts sending
// through Resend's HTTP API (plain fetch, no SDK, no new dependency). Leave
// either one blank and every call quietly reports "not configured" — nothing is
// sent, nothing is logged that could look like a failure, and no page ever
// breaks because email is off.
//
// Nothing in the app schedules email yet: saved-search alerts need a scheduler,
// which is deliberately not built. This module is the seam those features will
// call. See GO-LIVE.md ("Email").
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain text — every message we send stays readable without HTML. */
  text: string;
  html?: string;
};

export type SendResult =
  | { status: "sent"; id: string | null }
  | { status: "not-configured" }
  | { status: "failed"; reason: string };

/** True when the owner has connected an email provider. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Send one email. NEVER throws: callers (server actions, background work) get
 * a result object and carry on, because a mail outage must not take a page
 * down with it. The API key is never logged — only whether it is set.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { status: "not-configured" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Status only — a provider error body can echo back the recipient.
      logger.warn("email.send.rejected", { status: response.status });
      return { status: "failed", reason: `http_${response.status}` };
    }

    const body = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;
    return { status: "sent", id: body?.id ?? null };
  } catch (err) {
    logger.warn("email.send.error", {
      name: err instanceof Error ? err.name : "unknown",
    });
    return { status: "failed", reason: "network" };
  }
}
