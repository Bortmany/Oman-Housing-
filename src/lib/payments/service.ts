import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Actor } from "@/lib/listings/rules";
import {
  confirmOwnPayment,
  confirmPayment,
  startFeaturedCheckout,
  type ConfirmOutcome,
  type GatewayLookup,
  type GatewayStart,
  type StartResult,
} from "./core";
import { getFeaturedPrice } from "./prices";
import { createCheckoutSession, isThawaniEnabled, lookupSession, payUrlFor } from "./thawani";

// The real wiring of the payment core: Thawani (dormant without keys), the
// price settings, and the site's own address. Return and cancel addresses are
// built from AUTH_URL, never from the request's Host header.

/** Who may open a checkout: a private owner or an agency user. Anyone else: null. */
export async function featureActor(): Promise<Actor | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  if (user.role === "USER" && !user.agencyId) return { userId: user.id, agencyId: null };
  if (user.role === "AGENCY" && user.agencyId) {
    // The session can be a few minutes old: confirm the agency link is still real.
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, agencyId: true } });
    if (row?.role === "AGENCY" && row.agencyId === user.agencyId) {
      return { userId: user.id, agencyId: user.agencyId };
    }
  }
  return null;
}

export function paymentsEnabled(): boolean {
  return isThawaniEnabled();
}

function realGatewayStart(locale: "en" | "ar"): GatewayStart {
  return {
    enabled: isThawaniEnabled(),
    payUrl: payUrlFor,
    async createSession({ paymentId, amountBaisa, productName }) {
      const origin = getSiteUrl();
      if (!origin) return null; // production without a valid AUTH_URL: refuse to send people away
      const back = `${origin}/api/payments/thawani/return?p=${encodeURIComponent(paymentId)}&l=${locale}`;
      // Cancel comes back the same way: we ask Thawani, who says "cancelled",
      // and the result page then reads "not completed".
      return createCheckoutSession({ paymentId, amountBaisa, productName, successUrl: back, cancelUrl: back });
    },
  };
}

const realGatewayLookup: GatewayLookup = {
  get enabled() {
    return isThawaniEnabled();
  },
  lookup: lookupSession,
};

export function startCheckout(actor: Actor, listingId: string, locale: "en" | "ar"): Promise<StartResult> {
  return startFeaturedCheckout(actor, listingId, realGatewayStart(locale), getFeaturedPrice);
}

export function settlePayment(paymentId: string, opts: { logUnknown?: boolean } = {}): Promise<ConfirmOutcome> {
  return confirmPayment(paymentId, realGatewayLookup, opts);
}

export function settleOwnPayment(userId: string, paymentId: string): Promise<ConfirmOutcome> {
  return confirmOwnPayment(userId, paymentId, realGatewayLookup);
}
