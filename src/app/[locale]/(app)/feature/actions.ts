"use server";

// Featured-listing checkout actions (owners and agencies). The browser sends
// ONLY a listing id (or our own payment id): never an amount, a status or a
// gateway session. Price and days are read on the server and frozen on the
// payment. Everything re-checks sign-in and ownership itself.

import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/payments/core";
import { featureActor, settleOwnPayment, startCheckout } from "@/lib/payments/service";

const HOUR = 60 * 60 * 1000;

export type StartPaymentResult =
  | { ok: true; url: string }
  | { ok: false; error: "rateLimited" | "wrongState" | "startFailed" };

export type CheckPaymentResult = { ok: true } | { ok: false; error: "rateLimited" | "startFailed" };

/** "Pay by card": returns the gateway page address; the page then navigates with script. */
export async function startFeaturedPayment(listingId: string): Promise<StartPaymentResult> {
  const actor = await featureActor();
  const id = typeof listingId === "string" ? listingId.slice(0, 64) : "";
  if (!actor || !id) return { ok: false, error: "wrongState" };

  const byUser = checkRateLimit(`feature:start:user:${actor.userId}`, { limit: 10, windowMs: HOUR });
  const byListing = checkRateLimit(`feature:start:listing:${id}`, { limit: 5, windowMs: HOUR });
  if (!byUser.allowed || !byListing.allowed) {
    // Written once per window, so a flood cannot flood the log too.
    if (byUser.count === 11 || byListing.count === 6) {
      await recordEvent("RATE_LIMITED", "Too many checkout starts.", { listingId: id });
    }
    return { ok: false, error: "rateLimited" };
  }

  const locale = (await getLocale()) === "ar" ? "ar" : "en";
  const result = await startCheckout(actor, id, locale);
  if (result.ok) return { ok: true, url: result.url };
  // A missing and a not-yours listing are the same answer.
  return { ok: false, error: result.error === "startFailed" ? "startFailed" : "wrongState" };
}

/** "Check again" on the result page: asks the gateway about the payer's OWN payment. */
export async function checkFeaturedPayment(paymentId: string): Promise<CheckPaymentResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const id = typeof paymentId === "string" ? paymentId.slice(0, 64) : "";
  if (!userId || !id) return { ok: false, error: "startFailed" };

  const limit = checkRateLimit(`feature:check:user:${userId}`, { limit: 20, windowMs: HOUR });
  if (!limit.allowed) return { ok: false, error: "rateLimited" };

  const result = await settleOwnPayment(userId, id);
  return result.outcome === "unknown" ? { ok: false, error: "startFailed" } : { ok: true };
}
