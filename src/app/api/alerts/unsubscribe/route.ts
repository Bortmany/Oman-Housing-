import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyUnsubscribe } from "@/lib/alerts/unsubscribe";
import { FREQUENCY_OFF } from "@/lib/savedSearch";
import { escapeHtml } from "@/lib/escape-html";
import { toAlertLocale } from "@/lib/alerts/template";
import en from "../../../../../messages/en.json";
import ar from "../../../../../messages/ar.json";

// Public one-click unsubscribe for alert emails. No login: the signed link IS
// the permission, and it only switches off ONE saved search's alerts. Safe to
// call twice (idempotent). GET = someone clicked the link in the email; POST =
// their mail app's own "Unsubscribe" button (List-Unsubscribe-Post).
// The page tells them the truth either way, in English or Arabic.

export const dynamic = "force-dynamic";

async function handle(request: Request, wantsPage: boolean) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("s") ?? "").slice(0, 64);
  const sig = url.searchParams.get("t") ?? "";
  const locale = toAlertLocale(url.searchParams.get("lang"));

  // Public and unauthenticated: count every call per visitor address so it
  // cannot be used to hammer the database or guess signatures.
  const limit = checkRateLimit(`unsubscribe:ip:${getClientIp(request.headers)}`, {
    limit: 120, // mail providers share addresses; stay generous
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    const res = reply(locale, "error", 429, wantsPage);
    res.headers.set("Retry-After", String(limit.retryAfter));
    return res;
  }

  const ok = verifyUnsubscribe(id, sig);

  if (ok) {
    try {
      // A missing search (already deleted) is fine: nothing to switch off.
      await prisma.savedSearch.updateMany({
        where: { id },
        data: { frequency: FREQUENCY_OFF },
      });
    } catch (err) {
      logger.error("alerts.unsubscribe.failed", err, { savedSearchId: id });
      Sentry.captureException(err, { tags: { route: "alerts-unsubscribe" }, extra: { savedSearchId: id } });
      return reply(locale, "error", 500, wantsPage);
    }
  }
  return reply(locale, ok ? "done" : "invalid", ok ? 200 : 400, wantsPage);
}

function reply(
  locale: "en" | "ar",
  kind: "done" | "invalid" | "error",
  status: number,
  wantsPage: boolean,
) {
  const t = (locale === "ar" ? ar : en).alertUnsubscribe;
  const title = t[`${kind}Title`];
  const body = t[`${kind}Body`];
  if (!wantsPage) {
    return NextResponse.json({ ok: kind === "done" }, { status });
  }
  const dir = locale === "ar" ? "rtl" : "ltr";
  const html =
    `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">` +
    `<title>${escapeHtml(title)}</title></head>` +
    `<body style="margin:0;background:#fafaf9;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">` +
    `<main style="max-width:480px;margin:64px auto;padding:0 16px;">` +
    `<h1 style="font-size:22px;margin:0 0 12px 0;">${escapeHtml(title)}</h1>` +
    `<p style="font-size:16px;line-height:1.5;margin:0 0 16px 0;">${escapeHtml(body)}</p>` +
    `<p><a href="/${locale}/account" style="color:#0f766e;font-weight:bold;">${escapeHtml(t.manage)}</a></p>` +
    `</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const GET = (request: Request) => handle(request, true);
// Mail apps send the one-click POST in the background; they only need a status.
export const POST = (request: Request) => handle(request, false);
