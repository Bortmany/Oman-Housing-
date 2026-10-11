// Featured-listing payments — the database half. No Next.js and no secrets in
// here (the gateway is passed in), so the tests can drive every case against
// the test database with a stubbed gateway.
//
// The rules, in short:
//  - Money is set on the server only: price and days are read from settings
//    when the checkout starts and frozen on the Payment.
//  - Only the exact gateway status "paid" counts, and only after WE asked the
//    gateway about the session stored on OUR payment row.
//  - The amount, the currency (OMR) AND our reference must ALL be present in
//    the gateway's answer and match what we stored. If any of the three is
//    missing we do not guess: nothing is featured, the payment stays pending
//    and an UNVERIFIABLE event is written (fail closed).
//  - "Mark paid and extend featuredUntil" is one conditional update inside one
//    transaction: a replay, a refresh or a double click does nothing.
//  - Featuring writes only Listing.featuredUntil. Never provenance,
//    confidence, status or price.

import { Prisma, type PaymentEventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { extendFeaturedUntil } from "@/lib/featured";
import { ownershipWhere, type Actor } from "@/lib/listings/rules";
import { baisaToAmount, toBaisa } from "./baisa";
import { MAX_DAYS, MIN_DAYS, type FeaturedPrice } from "./priceCore";
import type { SessionAnswer } from "./thawaniCore";

// ---------- The security / money log ----------

const DETAIL_MAX = 300;

/** Write one event row and a server log line. Never throws, never holds a secret. */
export async function recordEvent(
  kind: PaymentEventKind,
  detail: string,
  ids: { paymentId?: string | null; listingId?: string | null } = {},
): Promise<void> {
  const clean = detail.slice(0, DETAIL_MAX);
  logger.info("payments.event", { kind, detail: clean, paymentId: ids.paymentId ?? null, listingId: ids.listingId ?? null });
  try {
    await prisma.paymentEvent.create({
      data: { kind, detail: clean, paymentId: ids.paymentId ?? null, listingId: ids.listingId ?? null },
    });
  } catch (err) {
    logger.error("payments.event.write_failed", err, { kind });
  }
}

// ---------- Start a card checkout ----------

export type GatewayStart = {
  /** Keys are set. False = dormant: nothing is created. */
  enabled: boolean;
  /** Create the hosted session (null = could not). */
  createSession(input: {
    paymentId: string;
    amountBaisa: number;
    productName: string;
    listingId: string;
  }): Promise<{ sessionId: string } | null>;
  /** The page to send the payer to for a session. */
  payUrl(sessionId: string): string | null;
};

export type StartError = "notFound" | "wrongState" | "notEnabled" | "startFailed";
export type StartResult = { ok: true; url: string; paymentId: string; reused: boolean } | { ok: false; error: StartError };

const REUSE_WINDOW_MS = 10 * 60 * 1000;
/** A pending row with no session yet is "mid-call to the gateway" for this long. */
const INFLIGHT_MS = 30_000;
const WAIT_MAX_MS = 25_000;
const WAIT_POLL_MS = 100;

/**
 * Begin paying to feature a listing the actor OWNS. The browser sends only the
 * listing id. Same person + same listing within 10 minutes reuses the open
 * session; a short locked step makes two simultaneous presses create one
 * session (the slow gateway call itself runs outside any transaction).
 */
export async function startFeaturedCheckout(
  actor: Actor,
  listingId: string,
  gateway: GatewayStart,
  getPrice: (agencyId: string | null) => Promise<FeaturedPrice>,
  now: Date = new Date(),
): Promise<StartResult> {
  if (!listingId || listingId.length > 64) return { ok: false, error: "notFound" };

  // Ownership inside the query: someone else's listing and a missing one look the same.
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, ...ownershipWhere(actor) },
    select: {
      id: true,
      status: true,
      isSample: true,
      agencyId: true,
      property: { select: { titleEn: true, isSample: true } },
    },
  });
  if (!listing) return { ok: false, error: "notFound" };
  if (listing.status !== "ACTIVE" || listing.isSample || listing.property.isSample) {
    return { ok: false, error: "wrongState" };
  }
  if (!gateway.enabled) return { ok: false, error: "notEnabled" };

  const price = await getPrice(listing.agencyId);

  try {
    // Step 1 (short transaction, holds the lock): reuse an open session, wait
    // for a press that is mid-call to the gateway, or create our pending row.
    // The slow gateway call below runs OUTSIDE any transaction.
    const deadline = Date.now() + WAIT_MAX_MS;
    let payment: { id: string } | null = null;
    while (!payment) {
      const step = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`feature:${actor.userId}:${listing.id}`}))`;
          const open = await tx.payment.findFirst({
            where: {
              listingId: listing.id,
              userId: actor.userId,
              method: "THAWANI",
              status: "PENDING",
              createdAt: { gt: new Date(now.getTime() - REUSE_WINDOW_MS) },
            },
            orderBy: { createdAt: "desc" },
          });
          if (open?.gatewaySessionId) {
            const url = gateway.payUrl(open.gatewaySessionId);
            if (url) return { kind: "reuse" as const, url, paymentId: open.id };
          } else if (open && Date.now() - open.createdAt.getTime() < INFLIGHT_MS) {
            return { kind: "wait" as const }; // another press is talking to the gateway right now
          } else if (open) {
            // Abandoned attempt (no session after a long time): close it, start fresh.
            await tx.payment.updateMany({ where: { id: open.id, status: "PENDING", gatewaySessionId: null }, data: { status: "FAILED" } });
          }
          const created = await tx.payment.create({
            data: {
              listingId: listing.id,
              listingTitle: listing.property.titleEn.slice(0, 200),
              userId: actor.userId,
              method: "THAWANI",
              status: "PENDING",
              amount: new Prisma.Decimal(price.amount),
              currency: "OMR",
              days: price.days,
            },
          });
          return { kind: "mine" as const, id: created.id };
        },
        { timeout: 10_000, maxWait: 10_000 },
      );
      if (step.kind === "reuse") return { ok: true, url: step.url, paymentId: step.paymentId, reused: true };
      if (step.kind === "mine") {
        payment = { id: step.id };
        break;
      }
      if (Date.now() > deadline) return { ok: false, error: "startFailed" };
      await new Promise((r) => setTimeout(r, WAIT_POLL_MS));
    }

    // Step 2 (no transaction): ask the gateway for a session.
    let session: { sessionId: string } | null = null;
    try {
      session = await gateway.createSession({
        paymentId: payment.id,
        amountBaisa: price.baisa,
        productName: `Featured listing (${price.days} days)`,
        listingId: listing.id,
      });
    } catch (err) {
      logger.error("payments.start.gateway_failed", err, { listingId: listing.id });
    }
    const url = session ? gateway.payUrl(session.sessionId) : null;
    if (!session || !url) {
      await prisma.payment.updateMany({ where: { id: payment.id, status: "PENDING", gatewaySessionId: null }, data: { status: "FAILED" } });
      await recordEvent("SESSION_CREATE_FAILED", "The gateway did not give a payment session.", { paymentId: payment.id, listingId: listing.id });
      return { ok: false, error: "startFailed" };
    }

    // Step 3: attach the session only if nobody attached one first.
    const attached = await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING", gatewaySessionId: null },
      data: { gatewaySessionId: session.sessionId },
    });
    if (attached.count === 1) {
      await recordEvent("CHECKOUT_STARTED", `${price.amount} OMR for ${price.days} days (${price.audience} price)`, { paymentId: payment.id, listingId: listing.id });
      return { ok: true, url, paymentId: payment.id, reused: false };
    }
    // A concurrent press already attached a session: use that one. Ours is never handed out.
    const winner = await prisma.payment.findUnique({ where: { id: payment.id }, select: { gatewaySessionId: true, status: true } });
    const winnerUrl = winner?.status === "PENDING" && winner.gatewaySessionId ? gateway.payUrl(winner.gatewaySessionId) : null;
    if (winnerUrl) return { ok: true, url: winnerUrl, paymentId: payment.id, reused: true };
    return { ok: false, error: "startFailed" };
  } catch (err) {
    logger.error("payments.start.failed", err, { listingId: listing.id });
    return { ok: false, error: "startFailed" };
  }
}

// ---------- Confirm (the return page, "check again", admin re-check) ----------

export type GatewayLookup = {
  enabled: boolean;
  /** Ask the gateway about a session. null = the lookup failed. */
  lookup(sessionId: string): Promise<SessionAnswer | null>;
};

export type ConfirmOutcome =
  | { outcome: "paid"; featuredUntil: Date | null; firstTime: boolean }
  | { outcome: "pending" }
  | { outcome: "failed" }
  | { outcome: "unknown" };

/**
 * Settle one payment by asking the gateway. Safe to call any number of times,
 * from any number of requests at once: the listing is extended once.
 */
export async function confirmPayment(
  paymentId: string,
  gateway: GatewayLookup,
  opts: { logUnknown?: boolean; now?: Date } = {},
): Promise<ConfirmOutcome> {
  const now = opts.now ?? new Date();
  const id = typeof paymentId === "string" ? paymentId.slice(0, 64) : "";
  const payment = id ? await prisma.payment.findUnique({ where: { id } }) : null;
  if (!payment) {
    if (opts.logUnknown !== false) await recordEvent("UNKNOWN_PAYMENT", "A confirmation arrived for a payment id we do not have.");
    return { outcome: "unknown" };
  }

  const ids = { paymentId: payment.id, listingId: payment.listingId };

  if (payment.status === "PAID") {
    await recordEvent("ALREADY_CONFIRMED", "Confirmation repeated for a payment that is already paid. Nothing changed.", ids);
    return { outcome: "paid", featuredUntil: await currentEnd(payment.listingId), firstTime: false };
  }
  if (payment.method !== "THAWANI" || !payment.gatewaySessionId) {
    await recordEvent("UNVERIFIABLE", "This payment has no gateway session to check.", ids);
    return { outcome: payment.status === "FAILED" ? "failed" : "pending" };
  }
  // Dormant means dormant: no keys, no lookup.
  if (!gateway.enabled) return { outcome: payment.status === "FAILED" ? "failed" : "pending" };

  const answer = await gateway.lookup(payment.gatewaySessionId);
  if (!answer) {
    await recordEvent("LOOKUP_FAILED", "The gateway could not be asked about this payment.", ids);
    return { outcome: payment.status === "FAILED" ? "failed" : "pending" };
  }

  // Only the exact value "paid" counts.
  if (answer.status !== "paid") {
    const cancelled = answer.status === "cancelled" || answer.status === "expired";
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { gatewayPayload: answer.payload as Prisma.InputJsonValue, ...(cancelled ? { status: "FAILED" } : {}) },
    });
    await recordEvent("NOT_PAID", `Gateway says: ${(answer.status ?? "no status").slice(0, 40)}.`, ids);
    return { outcome: cancelled || payment.status === "FAILED" ? "failed" : "pending" };
  }

  // Cross-checks on the gateway's own answer. Any doubt = not paid. Amount,
  // currency and our reference must ALL be present (fail closed), then match.
  const expectedBaisa = toBaisa(payment.amount.toString());
  if (answer.amountBaisa == null || answer.currency == null || answer.reference == null) {
    const missing = [
      answer.amountBaisa == null ? "amount" : null,
      answer.currency == null ? "currency" : null,
      answer.reference == null ? "reference" : null,
    ].filter(Boolean).join(", ");
    await recordEvent("UNVERIFIABLE", `The gateway said paid but did not give: ${missing}. Not accepted.`, ids);
    return { outcome: "pending" };
  }
  if (expectedBaisa == null || answer.amountBaisa !== expectedBaisa) {
    await recordEvent("AMOUNT_MISMATCH", `Gateway amount ${answer.amountBaisa} baisa, expected ${expectedBaisa ?? "?"}.`, ids);
    return { outcome: "pending" };
  }
  if (answer.currency !== payment.currency) {
    await recordEvent("AMOUNT_MISMATCH", `Gateway currency ${answer.currency.slice(0, 8)}, expected ${payment.currency}.`, ids);
    return { outcome: "pending" };
  }
  if (answer.reference !== payment.id) {
    await recordEvent("REFERENCE_MISMATCH", "The gateway's reference is not this payment's.", ids);
    return { outcome: "pending" };
  }

  // The once-only effect: one conditional update, same transaction as the extension.
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: now, gatewayPayload: answer.payload as Prisma.InputJsonValue },
    });
    if (claimed.count !== 1) return { firstTime: false, end: null as Date | null };
    // Deliberate: even if the listing was paused after checkout started, a confirmed payment still extends featuredUntil (the buyer paid).
    const end = payment.listingId ? await extendListing(tx, payment.listingId, payment.days, now) : null;
    return { firstTime: true, end };
  });

  if (!result.firstTime) {
    await recordEvent("ALREADY_CONFIRMED", "Two confirmations arrived together; only one took effect.", ids);
    return { outcome: "paid", featuredUntil: await currentEnd(payment.listingId), firstTime: false };
  }
  await recordEvent("CONFIRMED", `Paid ${payment.amount.toFixed(3)} OMR; featured ${payment.days} days.`, ids);
  return { outcome: "paid", featuredUntil: result.end, firstTime: true };
}

/**
 * The payer's own "check again": only their OWN payment is looked up. Another
 * person's payment id is answered exactly like an unknown one.
 */
export async function confirmOwnPayment(
  userId: string,
  paymentId: string,
  gateway: GatewayLookup,
): Promise<ConfirmOutcome> {
  const id = typeof paymentId === "string" ? paymentId.slice(0, 64) : "";
  const own = id ? await prisma.payment.findFirst({ where: { id, userId }, select: { id: true } }) : null;
  if (!own) {
    await recordEvent("UNKNOWN_PAYMENT", "A payer asked about a payment that is not theirs or does not exist.");
    return { outcome: "unknown" };
  }
  return confirmPayment(own.id, gateway, { logUnknown: false });
}

async function currentEnd(listingId: string | null): Promise<Date | null> {
  if (!listingId) return null;
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { featuredUntil: true } });
  return l?.featuredUntil ?? null;
}

/**
 * Add `days` to a listing's featured end date. The row is locked first so two
 * extensions can never overwrite each other. Writes featuredUntil and nothing else.
 */
async function extendListing(
  tx: Prisma.TransactionClient,
  listingId: string,
  days: number,
  now: Date,
): Promise<Date | null> {
  const rows = await tx.$queryRaw<{ featuredUntil: Date | null }[]>`
    SELECT "featuredUntil" FROM "Listing" WHERE "id" = ${listingId} FOR UPDATE`;
  if (rows.length === 0) return null; // the listing was deleted meanwhile
  const end = extendFeaturedUntil(rows[0].featuredUntil, now, days);
  await tx.listing.update({ where: { id: listingId }, data: { featuredUntil: end } });
  return end;
}

// ---------- Admin: feature by hand, stop featuring ----------

export type ManualError = "notAdmin" | "notFound" | "wrongState" | "invalidDays" | "invalidAmount";
export type ManualResult = { ok: true; paymentId: string; featuredUntil: Date | null } | { ok: false; error: ManualError };

/** The admin has received a bank transfer (or is gifting): works like a paid card payment. */
export async function featureByHand(
  adminId: string,
  input: { listingId: string; days: number; amount: string; note: string },
  now: Date = new Date(),
): Promise<ManualResult> {
  // Belt and braces: the action already checked the role; the money code checks again.
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
  if (admin?.role !== "ADMIN") return { ok: false, error: "notAdmin" };
  if (!Number.isInteger(input.days) || input.days < MIN_DAYS || input.days > MAX_DAYS) return { ok: false, error: "invalidDays" };
  const baisa = toBaisa(input.amount);
  if (baisa == null || baisa > 10_000_000) return { ok: false, error: "invalidAmount" }; // 0.000 is allowed (a gift)

  const listing = await prisma.listing.findUnique({
    where: { id: String(input.listingId).slice(0, 64) },
    select: { id: true, status: true, isSample: true, createdById: true, property: { select: { titleEn: true, isSample: true } } },
  });
  if (!listing) return { ok: false, error: "notFound" };
  if (listing.status !== "ACTIVE" || listing.isSample || listing.property.isSample) return { ok: false, error: "wrongState" };

  const out = await prisma.$transaction(async (tx) => {
    // An identical repeat (same listing, days, amount, admin) within 10 seconds
    // is a double submit: return the earlier result, change nothing.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`manual:${adminId}:${listing.id}`}))`;
    const repeat = await tx.payment.findFirst({
      where: {
        listingId: listing.id,
        method: "MANUAL",
        recordedById: adminId,
        days: input.days,
        amount: new Prisma.Decimal(baisaToAmount(baisa)),
        createdAt: { gt: new Date(now.getTime() - 10_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (repeat) {
      const l = await tx.listing.findUnique({ where: { id: listing.id }, select: { featuredUntil: true } });
      return { paymentId: repeat.id, end: l?.featuredUntil ?? null };
    }
    const payment = await tx.payment.create({
      data: {
        listingId: listing.id,
        listingTitle: listing.property.titleEn.slice(0, 200),
        userId: listing.createdById,
        method: "MANUAL",
        status: "PAID",
        amount: new Prisma.Decimal(baisaToAmount(baisa)),
        currency: "OMR",
        days: input.days,
        paidAt: now,
        recordedById: adminId,
        note: input.note.trim().slice(0, 300) || null,
      },
    });
    const end = await extendListing(tx, listing.id, input.days, now);
    await tx.paymentEvent.create({
      data: { kind: "MANUAL_FEATURE", paymentId: payment.id, listingId: listing.id, detail: `Admin featured by hand: ${baisaToAmount(baisa)} OMR, ${input.days} days.` },
    });
    return { paymentId: payment.id, end };
  });
  return { ok: true, paymentId: out.paymentId, featuredUntil: out.end };
}

/** Stop featuring now. Recorded with the admin's reason. */
export async function stopFeaturing(
  adminId: string,
  listingId: string,
  reason: string,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  const id = String(listingId).slice(0, 64);
  const changed = await prisma.listing.updateMany({
    where: { id, featuredUntil: { gt: now } },
    data: { featuredUntil: now },
  });
  if (changed.count !== 1) return { ok: false };
  await recordEvent("MANUAL_UNFEATURE", `Admin stopped featuring. Reason: ${reason.trim().slice(0, 150) || "none given"}.`, { listingId: id });
  logger.info("payments.unfeature", { adminId, listingId: id });
  return { ok: true };
}

// ---------- Reads for the pages ----------

/** Events that deserve attention (the admin home badge counts these). */
export const FLAGGED_KINDS: PaymentEventKind[] = [
  "AMOUNT_MISMATCH",
  "REFERENCE_MISMATCH",
  "UNVERIFIABLE",
  "UNKNOWN_PAYMENT",
  "SESSION_CREATE_FAILED",
];

/** Routine entries, left out of the security log's main list. */
export const ROUTINE_KINDS: PaymentEventKind[] = ["CHECKOUT_STARTED", "CONFIRMED"];

/** For the admin home card: flagged events in the last 7 days. */
export async function countFlaggedEvents7d(now: Date = new Date()): Promise<number> {
  return prisma.paymentEvent.count({
    where: { kind: { in: FLAGGED_KINDS }, createdAt: { gt: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } },
  });
}
