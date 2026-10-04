import "server-only";
import { logger } from "@/lib/logger";
import { writeOutboxFile } from "@/lib/email/outbox";

// ---------------------------------------------------------------------------
// Sending email — the wiring, switched OFF until the owner connects a provider.
//
// Set RESEND_API_KEY and EMAIL_FROM in the environment and this starts sending
// through Resend's HTTP API (plain fetch, no SDK, no new dependency). Leave
// either one blank and every call quietly reports "not configured" — nothing is
// sent, nothing is logged that could look like a failure, and no page ever
// breaks because email is off.
//
// Saved-search alerts (src/lib/alerts, POST /api/jobs/saved-search-alerts) are
// the first caller. A third mode exists for local testing: EMAIL_DEV_LOG=true
// writes each message as a .eml file under DATA_DIR/outbox instead of sending
// it. It is IGNORED in production so real users are never silently swallowed.
// See GO-LIVE.md ("Email" and "Alert job").
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain text — every message we send stays readable without HTML. */
  text: string;
  html?: string;
  /** Generated id used in the outbox file name (never an address). */
  outboxName?: string;
  /** Extra mail headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
};

export type SendResult =
  | { status: "sent"; id: string | null }
  | { status: "outbox"; file: string }
  | { status: "not-configured" }
  | { status: "failed"; reason: string };

/** True when the owner has connected an email provider. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type EmailMode = "live" | "outbox" | "off";

/** Outbox (development test mode) wins over Resend; off in production. */
export function emailMode(): EmailMode {
  if (process.env.EMAIL_DEV_LOG === "true" && process.env.NODE_ENV !== "production") {
    return "outbox";
  }
  return isEmailConfigured() ? "live" : "off";
}

/**
 * Send one email. NEVER throws: callers (server actions, background work) get
 * a result object and carry on, because a mail outage must not take a page
 * down with it. The API key is never logged — only whether it is set.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (emailMode() === "outbox") {
    try {
      const file = await writeOutboxFile(message, message.outboxName ?? "mail");
      return { status: "outbox", file };
    } catch {
      return { status: "failed", reason: "outbox_write" };
    }
  }
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
        ...(message.headers ? { headers: message.headers } : {}),
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
