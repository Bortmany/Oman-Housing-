import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/payments/core";
import { settlePayment } from "@/lib/payments/service";

// Where Thawani sends the payer back to (success AND cancel). The address
// carries only OUR payment id and the language: no amount, no status, no
// gateway session. Nothing in it decides the outcome: we load our own payment
// row and ask the gateway about the session stored there. A refresh or a
// replayed address is harmless (the listing is extended once).
//
// With no gateway keys this route makes no lookup at all; it just shows the
// result page. It always answers with a redirect to the result page, which
// reads the real state from our database.

export const dynamic = "force-dynamic";

function resultRedirect(locale: "en" | "ar", paymentId: string) {
  // A relative address on purpose: nothing from the request's Host header is trusted.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/${locale}/feature/result?p=${encodeURIComponent(paymentId)}` },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = (url.searchParams.get("p") ?? "").slice(0, 64);
  const locale = url.searchParams.get("l") === "ar" ? "ar" : "en";
  const ip = getClientIp(request.headers);

  // Over the limit: send them to the result page and make no gateway call.
  const limit = checkRateLimit(`feature:return:ip:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return resultRedirect(locale, paymentId);

  try {
    const known = paymentId
      ? await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true } })
      : null;
    if (!known) {
      // Unknown ids are logged, but capped per visitor so the log cannot be flooded.
      if (checkRateLimit(`feature:unknown:ip:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 }).allowed) {
        await recordEvent("UNKNOWN_PAYMENT", "The return address had a payment id we do not have.");
      }
      return resultRedirect(locale, paymentId);
    }
    await settlePayment(known.id, { logUnknown: false });
  } catch (err) {
    logger.error("payments.return.failed", err);
  }
  return resultRedirect(locale, paymentId);
}
