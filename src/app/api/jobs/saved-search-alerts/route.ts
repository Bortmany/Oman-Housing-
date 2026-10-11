import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { checkCronAuth } from "@/lib/cronAuth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { emailMode, sendEmail } from "@/lib/email/send";
import { runSavedSearchAlerts } from "@/lib/alerts/runner";
import { logger } from "@/lib/logger";

// Hourly job: emails people about new listings that match their saved
// searches. Called by a scheduler (Railway cron) with
// `Authorization: Bearer <CRON_SECRET>`. POST only; no session is used.
// CRON_SECRET unset or shorter than 16 characters = 503 (never an open door);
// wrong or missing secret = 401 and nothing else is revealed.

export const dynamic = "force-dynamic";

const FAILED_AUTH_LIMIT = { limit: 20, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  const auth = checkCronAuth(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
  if (auth === "unavailable") {
    return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }
  if (auth === "unauthorized") {
    // Wrong guesses are rate limited per IP before any database work.
    const limit = checkRateLimit(`job-auth:${getClientIp(request.headers)}`, FAILED_AUTH_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const baseUrl =
    process.env.AUTH_URL ??
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!baseUrl) {
    logger.error("alerts.job.no_base_url");
    return NextResponse.json({ ok: false, reason: "base-url-missing" }, { status: 503 });
  }

  try {
    const mode = emailMode();
    const result = await runSavedSearchAlerts({ mode, send: sendEmail, baseUrl });
    if (result.status === "not-configured") {
      logger.info("alerts.job.not_configured", { due: result.due });
      return NextResponse.json({ ok: true, status: "not-configured" });
    }
    logger.info("alerts.job.done", {
      mode,
      checked: result.checked,
      due: result.due,
      sent: result.sent,
      failed: result.failed,
      deferred: result.deferred,
    });
    return NextResponse.json({
      ok: true,
      mode,
      checked: result.checked,
      due: result.due,
      sent: result.sent,
      failed: result.failed,
      deferred: result.deferred,
    });
  } catch (err) {
    logger.error("alerts.job.failed", err);
    Sentry.captureException(err, { tags: { job: "saved-search-alerts" } });
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
