// Featured-listing payments against the TEST database, with a stubbed gateway
// (Thawani is never called). Covers: ownership, frozen prices, double click,
// paid / unpaid / tampered amount / wrong reference / unknown id / another
// person's id / missing session, replay, two simultaneous confirms, late-paid,
// dormant, unique gateway session, hand-featuring, and "featuring never
// touches provenance, confidence, status or price". Run with: npm test
import type { SessionAnswer } from "./thawaniCore";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/_test(\?|$)/.test(url)) {
    console.error("Refusing to run: DATABASE_URL is not a *_test database.");
    process.exit(1);
  }
  const { prisma } = await import("@/lib/prisma");
  const core = await import("./core");
  const { featuredPriceFor } = await import("./priceCore");

  const run = `pay${Date.now()}`;
  const DAY = 24 * 3600 * 1000;
  const gov = await prisma.governorate.create({ data: { slug: `${run}-g`, nameEn: "G", nameAr: "ح" } });
  const city = await prisma.city.create({ data: { slug: `${run}-c`, nameEn: "C", nameAr: "م", governorateId: gov.id } });
  const hood = await prisma.neighborhood.create({ data: { slug: `${run}-n`, nameEn: "N", nameAr: "ن", cityId: city.id } });
  const mkUser = (n: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email: `${run}-${n}@example.com`, ...extra } });
  const ownerA = await mkUser("a");
  const ownerB = await mkUser("b");
  const admin = await mkUser("admin", { role: "ADMIN" });
  const agX = await prisma.agency.create({ data: { slug: `${run}-x`, nameEn: "X", isApproved: true } });
  const agY = await prisma.agency.create({ data: { slug: `${run}-y`, nameEn: "Y", isApproved: true } });
  const userX = await mkUser("x", { role: "AGENCY", agencyId: agX.id });
  const userY = await mkUser("y", { role: "AGENCY", agencyId: agY.id });
  const A = { userId: ownerA.id, agencyId: null };
  const B = { userId: ownerB.id, agencyId: null };
  const X = { userId: userX.id, agencyId: agX.id };
  const Y = { userId: userY.id, agencyId: agY.id };

  const mkListing = async (createdById: string, agencyId: string | null, over: Record<string, unknown> = {}, propOver: Record<string, unknown> = {}) => {
    const property = await prisma.property.create({
      data: { neighborhoodId: hood.id, type: "VILLA", titleEn: `Villa ${Math.random()}`, ...propOver },
    });
    return prisma.listing.create({
      data: {
        propertyId: property.id, listingType: "SALE", price: "185000.000", status: "ACTIVE",
        createdById, agencyId, provenance: "USER_SUBMITTED", confidence: 0.5, publishedAt: new Date(), ...over,
      },
    });
  };
  const reload = (id: string) => prisma.listing.findUniqueOrThrow({ where: { id } });
  const events = (kind: string, paymentId?: string) =>
    prisma.paymentEvent.count({ where: { kind: kind as never, ...(paymentId ? { paymentId } : {}) } });

  // ----- the pretend gateway -----
  let sessionCounter = 0;
  const startGateway = (enabled = true) => {
    const g = {
      enabled,
      created: 0,
      async createSession() {
        g.created++;
        await new Promise((r) => setTimeout(r, 25)); // gives a double click time to race
        return { sessionId: `${run}-cs-${++sessionCounter}` };
      },
      payUrl: (sid: string) => `https://uatcheckout.thawani.example/pay/${sid}?key=pk`,
    };
    return g;
  };
  const lookupGateway = (answer: (sid: string) => SessionAnswer | null, enabled = true) => {
    const g = {
      enabled,
      lookups: 0,
      async lookup(sid: string) {
        g.lookups++;
        return answer(sid);
      },
    };
    return g;
  };
  const answerFor = (payment: { id: string; amount: { toString(): string } }, over: Partial<SessionAnswer> = {}) =>
    (): SessionAnswer => ({
      status: "paid",
      amountBaisa: Math.round(Number(payment.amount.toString()) * 1000),
      reference: payment.id,
      currency: "OMR",
      payload: { payment_status: "paid" },
      ...over,
    });
  const prices = (agencyId: string | null) => Promise.resolve(featuredPriceFor(agencyId, {}));

  try {
    // ===== starting a checkout =====
    const lA = await mkListing(ownerA.id, null);
    const lX = await mkListing(userX.id, agX.id);
    const gw = startGateway();

    const s1 = await core.startFeaturedCheckout(A, lA.id, gw, prices);
    expectEqual("owner can start a checkout", s1.ok, true);
    const pay1 = await prisma.payment.findFirstOrThrow({ where: { listingId: lA.id } });
    expectEqual("owner price frozen: 3.000 OMR, 30 days, pending", [pay1.amount.toString(), pay1.days, pay1.status, pay1.method, pay1.currency], ["3", 30, "PENDING", "THAWANI", "OMR"]);
    expectEqual("session id stored on our payment", pay1.gatewaySessionId?.startsWith(run), true);
    expectEqual("checkout start is logged", await events("CHECKOUT_STARTED", pay1.id), 1);
    expectEqual("nothing is featured yet", (await reload(lA.id)).featuredUntil, null);

    const sx = await core.startFeaturedCheckout(X, lX.id, gw, prices);
    const payX = await prisma.payment.findFirstOrThrow({ where: { listingId: lX.id } });
    expectEqual("agency price frozen: 6.000 OMR", [sx.ok, payX.amount.toString()], [true, "6"]);

    // Ownership: someone else's listing and a missing one look the same.
    const notMine = await core.startFeaturedCheckout(B, lA.id, gw, prices);
    const missing = await core.startFeaturedCheckout(B, "does-not-exist", gw, prices);
    expectEqual("another owner cannot start a checkout", notMine, { ok: false, error: "notFound" });
    expectEqual("not-yours and missing give the same answer", notMine, missing);
    expectEqual("another agency cannot start a checkout", (await core.startFeaturedCheckout(Y, lX.id, gw, prices)), { ok: false, error: "notFound" });
    expectEqual("an agency cannot feature an owner's listing", (await core.startFeaturedCheckout(X, lA.id, gw, prices)), { ok: false, error: "notFound" });
    expectEqual("an owner cannot feature an agency's listing", (await core.startFeaturedCheckout(A, lX.id, gw, prices)), { ok: false, error: "notFound" });

    // Live listings only, never sample records.
    const draft = await mkListing(ownerA.id, null, { status: "DRAFT" });
    const sample = await mkListing(ownerA.id, null, { isSample: true });
    const pending = await mkListing(ownerA.id, null, { status: "PENDING_REVIEW" });
    for (const [label, l] of [["draft", draft], ["in review", pending], ["sample", sample]] as const) {
      expectEqual(`a ${label} listing cannot be featured`, await core.startFeaturedCheckout(A, l.id, gw, prices), { ok: false, error: "wrongState" });
    }
    expectEqual("no payment rows for refused listings", await prisma.payment.count({ where: { listingId: { in: [draft.id, sample.id, pending.id] } } }), 0);

    // Dormant: nothing is created.
    const lDorm = await mkListing(ownerA.id, null);
    const dormant = startGateway(false);
    expectEqual("dormant gateway: not enabled", await core.startFeaturedCheckout(A, lDorm.id, dormant, prices), { ok: false, error: "notEnabled" });
    expectEqual("dormant gateway: no session asked for, no payment row", [dormant.created, await prisma.payment.count({ where: { listingId: lDorm.id } })], [0, 0]);

    // Double click: two presses at once make ONE session; a later press reuses it.
    const lDbl = await mkListing(ownerA.id, null);
    const gwDbl = startGateway();
    const [d1, d2] = await Promise.all([
      core.startFeaturedCheckout(A, lDbl.id, gwDbl, prices),
      core.startFeaturedCheckout(A, lDbl.id, gwDbl, prices),
    ]);
    expectEqual("double click: one session created", gwDbl.created, 1);
    expectEqual("double click: one payment row", await prisma.payment.count({ where: { listingId: lDbl.id } }), 1);
    expectEqual("double click: both get the same address", d1.ok && d2.ok && d1.url === d2.url, true);
    const d3 = await core.startFeaturedCheckout(A, lDbl.id, gwDbl, prices);
    expectEqual("a press within 10 minutes reuses the open session", [gwDbl.created, d3.ok && d3.reused], [1, true]);

    // The gateway call runs OUTSIDE any transaction: our pending row is already
    // committed (visible to another connection) while the gateway is still thinking.
    const lOut = await mkListing(ownerA.id, null);
    let visibleDuringCall: boolean | null = null;
    const watching = {
      ...startGateway(),
      async createSession(input: { paymentId: string }) {
        visibleDuringCall = (await prisma.payment.findUnique({ where: { id: input.paymentId } })) != null;
        return { sessionId: `${run}-cs-${++sessionCounter}` };
      },
    };
    await core.startFeaturedCheckout(A, lOut.id, watching, prices);
    expectEqual("pending row is committed before the gateway is called", visibleDuringCall, true);

    // A concurrent press attached a session while ours was being made: reuse it, never two live sessions.
    const lRace2 = await mkListing(ownerA.id, null);
    const racing = {
      ...startGateway(),
      async createSession(input: { paymentId: string }) {
        await prisma.payment.update({ where: { id: input.paymentId }, data: { gatewaySessionId: `${run}-winner` } });
        return { sessionId: `${run}-loser` };
      },
    };
    const raceStart = await core.startFeaturedCheckout(A, lRace2.id, racing, prices);
    const racePay = await prisma.payment.findFirstOrThrow({ where: { listingId: lRace2.id } });
    expectEqual("attach race: the earlier session wins and is reused", [raceStart.ok && raceStart.url.includes(`${run}-winner`), raceStart.ok && raceStart.reused, racePay.gatewaySessionId], [true, true, `${run}-winner`]);

    // A slow gateway: a second press waits for the first and does not make a second session.
    const lSlow = await mkListing(ownerA.id, null);
    const slow = startGateway();
    const slowCreate = slow.createSession;
    slow.createSession = async () => { await new Promise((r) => setTimeout(r, 600)); return slowCreate.call(slow); };
    const [sl1, sl2] = await Promise.all([
      core.startFeaturedCheckout(A, lSlow.id, slow, prices),
      (async () => { await new Promise((r) => setTimeout(r, 150)); return core.startFeaturedCheckout(A, lSlow.id, slow, prices); })(),
    ]);
    expectEqual("slow gateway: second press waits, one session, same address", [slow.created, sl1.ok && sl2.ok && sl1.url === sl2.url], [1, true]);

    // A price change affects the NEXT payment only.
    const lNew = await mkListing(ownerA.id, null);
    const dearer = (agencyId: string | null) => Promise.resolve(featuredPriceFor(agencyId, { "price.featured.owner": "4.500", "featured.days": "45" }));
    await core.startFeaturedCheckout(A, lNew.id, gw, dearer);
    const payNew = await prisma.payment.findFirstOrThrow({ where: { listingId: lNew.id } });
    expectEqual("new price applies to the new payment", [payNew.amount.toString(), payNew.days], ["4.5", 45]);
    expectEqual("the earlier payment keeps the price it was charged", (await prisma.payment.findUniqueOrThrow({ where: { id: pay1.id } })).amount.toString(), "3");

    // A gateway that cannot make a session: nothing charged, marked failed, logged.
    const lFail = await mkListing(ownerA.id, null);
    const broken = { ...startGateway(), async createSession() { return null; } };
    expectEqual("session failure is reported", await core.startFeaturedCheckout(A, lFail.id, broken, prices), { ok: false, error: "startFailed" });
    const failedPay = await prisma.payment.findFirstOrThrow({ where: { listingId: lFail.id } });
    expectEqual("failed start: payment FAILED and logged", [failedPay.status, await events("SESSION_CREATE_FAILED", failedPay.id)], ["FAILED", 1]);

    // ===== confirming =====
    // Not paid: nothing changes.
    const unpaidGw = lookupGateway(() => ({ status: "unpaid", amountBaisa: 3000, reference: pay1.id, currency: "OMR", payload: {} }));
    const r0 = await core.confirmPayment(pay1.id, unpaidGw);
    expectEqual("unpaid: stays pending, listing not featured", [r0.outcome, (await reload(lA.id)).featuredUntil, (await prisma.payment.findUniqueOrThrow({ where: { id: pay1.id } })).status], ["pending", null, "PENDING"]);
    expectEqual("unpaid: logged", await events("NOT_PAID", pay1.id), 1);

    // Tampering: each refused, nothing extended, an event written.
    const tamper: Array<[string, Partial<SessionAnswer>, string]> = [
      ["wrong amount", { amountBaisa: 1000 }, "AMOUNT_MISMATCH"],
      ["wrong currency", { currency: "USD" }, "AMOUNT_MISMATCH"],
      ["wrong reference", { reference: "someone-elses-payment" }, "REFERENCE_MISMATCH"],
      ["missing amount", { amountBaisa: null }, "UNVERIFIABLE"],
      ["missing currency", { currency: null }, "UNVERIFIABLE"],
      ["missing reference", { reference: null }, "UNVERIFIABLE"],
    ];
    for (const [label, over, kind] of tamper) {
      const before = await events(kind, pay1.id);
      const g = lookupGateway(answerFor(pay1, over));
      const r = await core.confirmPayment(pay1.id, g);
      expectEqual(`tampered (${label}): refused`, r.outcome, "pending");
      expectEqual(`tampered (${label}): not featured, still pending`, [(await reload(lA.id)).featuredUntil, (await prisma.payment.findUniqueOrThrow({ where: { id: pay1.id } })).status], [null, "PENDING"]);
      expectEqual(`tampered (${label}): event written`, (await events(kind, pay1.id)) - before, 1);
    }
    // Only the EXACT word "paid" counts.
    const capital = lookupGateway(answerFor(pay1, { status: "Paid" }));
    expectEqual('"Paid" (capital P) is not paid', (await core.confirmPayment(pay1.id, capital)).outcome, "pending");
    expectEqual("capital-P did not feature the listing", (await reload(lA.id)).featuredUntil, null);

    // Unknown id, and a lookup that fails.
    const unknownBefore = await events("UNKNOWN_PAYMENT");
    const never = lookupGateway(() => null);
    expectEqual("unknown payment id: refused", (await core.confirmPayment("no-such-payment", never)).outcome, "unknown");
    expectEqual("unknown payment id: logged, no lookup made", [(await events("UNKNOWN_PAYMENT")) - unknownBefore, never.lookups], [1, 0]);
    expectEqual("lookup failure keeps it pending", (await core.confirmPayment(pay1.id, lookupGateway(() => null))).outcome, "pending");
    expectEqual("lookup failure is logged", await events("LOOKUP_FAILED", pay1.id), 1);

    // Another person's payment id: refused like an unknown one.
    const otherGw = lookupGateway(answerFor(pay1));
    expectEqual("another user's payment id is refused", (await core.confirmOwnPayment(ownerB.id, pay1.id, otherGw)).outcome, "unknown");
    expectEqual("...and no lookup was made, nothing featured", [otherGw.lookups, (await reload(lA.id)).featuredUntil], [0, null]);

    // Dormant: no lookup at all.
    const dormantLookup = lookupGateway(answerFor(pay1), false);
    expectEqual("dormant: confirm makes no lookup", [(await core.confirmPayment(pay1.id, dormantLookup)).outcome, dormantLookup.lookups], ["pending", 0]);

    // A payment without a gateway session cannot be confirmed by card.
    const noSession = await prisma.payment.create({
      data: { listingId: lA.id, listingTitle: "x", userId: ownerA.id, method: "THAWANI", amount: "3.000", days: 30, createdAt: new Date(Date.now() - 3600_000) }, // old, so it is not mistaken for a press in progress
    });
    const noSessionGw = lookupGateway(answerFor(noSession));
    expectEqual("missing session id: refused, no lookup", [(await core.confirmPayment(noSession.id, noSessionGw)).outcome, noSessionGw.lookups], ["pending", 0]);

    // THE paid case.
    const t0 = Date.now();
    const paidGw = lookupGateway(answerFor(pay1));
    const ok1 = await core.confirmPayment(pay1.id, paidGw);
    const after1 = await reload(lA.id);
    expectEqual("paid: outcome", ok1.outcome === "paid" && ok1.firstTime, true);
    expectEqual("paid: payment marked PAID with a time and the gateway answer", await prisma.payment.findUniqueOrThrow({ where: { id: pay1.id } }).then((p) => [p.status, p.paidAt != null, p.gatewayPayload != null]), ["PAID", true, true]);
    const end1 = after1.featuredUntil!.getTime();
    expectEqual("paid: featured for exactly the payment's 30 days", Math.abs(end1 - (t0 + 30 * DAY)) < 60_000, true);
    expectEqual("paid: confirmed event written", await events("CONFIRMED", pay1.id), 1);

    // Replay and refresh: extended once.
    for (let i = 0; i < 3; i++) await core.confirmPayment(pay1.id, lookupGateway(answerFor(pay1)));
    expectEqual("replays: end date did not move", (await reload(lA.id)).featuredUntil!.getTime(), end1);
    expectEqual("replays: logged as repeated confirmations", await events("ALREADY_CONFIRMED", pay1.id), 3);
    expectEqual("replays: no gateway lookup needed once paid", (await core.confirmPayment(pay1.id, paidGw)) && paidGw.lookups, 1);

    // Two simultaneous confirms on a fresh payment: once.
    const lRace = await mkListing(ownerA.id, null);
    await core.startFeaturedCheckout(A, lRace.id, gw, prices);
    const payRace = await prisma.payment.findFirstOrThrow({ where: { listingId: lRace.id } });
    const tRace = Date.now();
    await Promise.all([1, 2, 3, 4].map(() => core.confirmPayment(payRace.id, lookupGateway(answerFor(payRace)))));
    const raced = (await reload(lRace.id)).featuredUntil!.getTime();
    expectEqual("simultaneous confirms: extended ONCE (30 days, not 60 or more)", Math.abs(raced - (tRace + 30 * DAY)) < 60_000, true);
    expectEqual("simultaneous confirms: one CONFIRMED event", await events("CONFIRMED", payRace.id), 1);

    // Paying again adds 30 days AFTER the current end.
    const startAgain = await core.startFeaturedCheckout(A, lA.id, gw, prices);
    expectEqual("a featured listing can be paid for again", startAgain.ok, true);
    const payAgain = await prisma.payment.findFirstOrThrow({ where: { listingId: lA.id, status: "PENDING", gatewaySessionId: { not: null } }, orderBy: { createdAt: "desc" } });
    expectEqual("the new payment is not the old one", payAgain.id !== pay1.id, true);
    await core.confirmPayment(payAgain.id, lookupGateway(answerFor(payAgain)));
    expectEqual("repeat payment adds 30 days after the current end", (await reload(lA.id)).featuredUntil!.getTime(), end1 + 30 * DAY);

    // Late-paid: a payment marked FAILED (cancelled earlier) that is later paid is honoured, once.
    const lLate = await mkListing(ownerA.id, null);
    await core.startFeaturedCheckout(A, lLate.id, gw, prices);
    const payLate = await prisma.payment.findFirstOrThrow({ where: { listingId: lLate.id } });
    const cancelled = lookupGateway(() => ({ status: "cancelled", amountBaisa: 3000, reference: payLate.id, currency: "OMR", payload: {} }));
    expectEqual("cancelled session: reads as not completed", (await core.confirmPayment(payLate.id, cancelled)).outcome, "failed");
    expectEqual("cancelled session: payment FAILED, listing not featured", [(await prisma.payment.findUniqueOrThrow({ where: { id: payLate.id } })).status, (await reload(lLate.id)).featuredUntil], ["FAILED", null]);
    const tLate = Date.now();
    await core.confirmPayment(payLate.id, lookupGateway(answerFor(payLate)));
    await core.confirmPayment(payLate.id, lookupGateway(answerFor(payLate)));
    const lateEnd = (await reload(lLate.id)).featuredUntil!.getTime();
    expectEqual("late-paid FAILED payment is honoured once", Math.abs(lateEnd - (tLate + 30 * DAY)) < 60_000, true);

    // Unique gateway session: a second payment cannot take the same session.
    let uniqueRefused = false;
    try {
      await prisma.payment.create({
        data: { listingId: lA.id, listingTitle: "x", userId: ownerA.id, method: "THAWANI", amount: "3.000", days: 30, gatewaySessionId: pay1.gatewaySessionId },
      });
    } catch {
      uniqueRefused = true;
    }
    expectEqual("the database refuses a second payment on the same gateway session", uniqueRefused, true);
    const manyNull = await Promise.all([1, 2].map(() => prisma.payment.create({ data: { listingId: lA.id, listingTitle: "x", userId: ownerA.id, method: "MANUAL", amount: "0.000", days: 1 } }).then(() => true, () => false)));
    expectEqual("many payments without a session are fine", manyNull, [true, true]);

    // ===== honesty: featuring changes only featuredUntil =====
    const lH = await mkListing(ownerA.id, null, { provenance: "USER_SUBMITTED", confidence: 0.5, price: "185000.000" });
    const snap = (l: { provenance: string; confidence: number; status: string; price: { toString(): string }; rentPeriod: string | null; listingType: string; isSample: boolean; propertyId: string }) =>
      [l.provenance, l.confidence, l.status, l.price.toString(), l.rentPeriod, l.listingType, l.isSample, l.propertyId];
    const before = snap(await reload(lH.id));
    const propBefore = await prisma.property.findUniqueOrThrow({ where: { id: lH.propertyId } });
    await core.startFeaturedCheckout(A, lH.id, gw, prices);
    const payH = await prisma.payment.findFirstOrThrow({ where: { listingId: lH.id } });
    await core.confirmPayment(payH.id, lookupGateway(answerFor(payH)));
    expectEqual("after a card payment: provenance, confidence, status, price unchanged", snap(await reload(lH.id)), before);
    const hand = await core.featureByHand(admin.id, { listingId: lH.id, days: 10, amount: "0.000", note: "gift" });
    expectEqual("hand-feature (a gift, 0.000) is accepted", hand.ok, true);
    expectEqual("after hand-featuring: provenance, confidence, status, price unchanged", snap(await reload(lH.id)), before);
    const propAfter = await prisma.property.findUniqueOrThrow({ where: { id: lH.propertyId } });
    expectEqual("the home's own record is untouched too", [propAfter.provenance, propAfter.confidence, propAfter.sourceNote, propAfter.isSample], [propBefore.provenance, propBefore.confidence, propBefore.sourceNote, propBefore.isSample]);

    // ===== feature by hand =====
    const lM = await mkListing(userX.id, agX.id);
    expectEqual("a non-admin cannot feature by hand", await core.featureByHand(ownerA.id, { listingId: lM.id, days: 30, amount: "3.000", note: "" }), { ok: false, error: "notAdmin" });
    expectEqual("...nor an agency user", await core.featureByHand(userX.id, { listingId: lM.id, days: 30, amount: "3.000", note: "" }), { ok: false, error: "notAdmin" });
    expectEqual("nothing was featured by the refused attempts", (await reload(lM.id)).featuredUntil, null);
    for (const [label, input, err] of [
      ["0 days", { days: 0, amount: "3.000" }, "invalidDays"],
      ["366 days", { days: 366, amount: "3.000" }, "invalidDays"],
      ["bad amount", { days: 30, amount: "abc" }, "invalidAmount"],
      ["4 decimals", { days: 30, amount: "3.0001" }, "invalidAmount"],
      ["negative", { days: 30, amount: "-3" }, "invalidAmount"],
    ] as const) {
      expectEqual(`hand-feature refuses ${label}`, await core.featureByHand(admin.id, { listingId: lM.id, note: "", ...input }), { ok: false, error: err });
    }
    expectEqual("hand-feature refuses a draft", await core.featureByHand(admin.id, { listingId: draft.id, days: 30, amount: "3.000", note: "" }), { ok: false, error: "wrongState" });
    expectEqual("hand-feature refuses a sample record", await core.featureByHand(admin.id, { listingId: sample.id, days: 30, amount: "3.000", note: "" }), { ok: false, error: "wrongState" });
    expectEqual("hand-feature refuses a missing listing", await core.featureByHand(admin.id, { listingId: "nope", days: 30, amount: "3.000", note: "" }), { ok: false, error: "notFound" });
    const tM = Date.now();
    const done = await core.featureByHand(admin.id, { listingId: lM.id, days: 30, amount: "6.000", note: "INV-1" });
    const manual = await prisma.payment.findFirstOrThrow({ where: { listingId: lM.id } });
    expectEqual("hand-feature records a paid MANUAL payment with note and admin", [done.ok, manual.method, manual.status, manual.amount.toString(), manual.note, manual.recordedById, manual.gatewaySessionId], [true, "MANUAL", "PAID", "6", "INV-1", admin.id, null]);
    expectEqual("hand-feature extends like a card payment", Math.abs((await reload(lM.id)).featuredUntil!.getTime() - (tM + 30 * DAY)) < 60_000, true);
    expectEqual("hand-feature is logged", await events("MANUAL_FEATURE", manual.id), 1);
    const endAfterFirst = (await reload(lM.id)).featuredUntil!.getTime();
    const repeatHand = await core.featureByHand(admin.id, { listingId: lM.id, days: 30, amount: "6.000", note: "INV-1" });
    expectEqual("identical repeat within 10s: earlier result returned", repeatHand.ok && repeatHand.paymentId === manual.id && repeatHand.featuredUntil?.getTime() === endAfterFirst, true);
    expectEqual("identical repeat: no second payment, end date unmoved", [await prisma.payment.count({ where: { listingId: lM.id } }), (await reload(lM.id)).featuredUntil!.getTime()], [1, endAfterFirst]);
    const differentHand = await core.featureByHand(admin.id, { listingId: lM.id, days: 31, amount: "6.000", note: "" });
    expectEqual("a different request (days) is not treated as a repeat", differentHand.ok && differentHand.paymentId !== manual.id, true);
    await prisma.payment.deleteMany({ where: { listingId: lM.id, id: { not: manual.id } } });
    await prisma.listing.update({ where: { id: lM.id }, data: { featuredUntil: new Date(endAfterFirst) } });
    const laterHand = await core.featureByHand(admin.id, { listingId: lM.id, days: 30, amount: "6.000", note: "" }, new Date(Date.now() + 11_000));
    expectEqual("the same request 10+ seconds later goes through", laterHand.ok && laterHand.paymentId !== manual.id, true);
    await prisma.payment.deleteMany({ where: { listingId: lM.id, id: { not: manual.id } } });
    await prisma.listing.update({ where: { id: lM.id }, data: { featuredUntil: new Date(endAfterFirst) } });
    const stopped = await core.stopFeaturing(admin.id, lM.id, "paid by mistake");
    expectEqual("stop featuring ends it now", [stopped.ok, (await reload(lM.id)).featuredUntil!.getTime() <= Date.now()], [true, true]);
    expectEqual("stop featuring is logged with the reason", (await prisma.paymentEvent.findFirst({ where: { kind: "MANUAL_UNFEATURE", listingId: lM.id } }))?.detail.includes("paid by mistake"), true);
    expectEqual("stopping a listing that is not featured does nothing", (await core.stopFeaturing(admin.id, lM.id, "again")).ok, false);

    // ===== a deleted listing keeps its payment record =====
    const lGone = await mkListing(ownerA.id, null);
    await core.featureByHand(admin.id, { listingId: lGone.id, days: 5, amount: "1.000", note: "" });
    await prisma.listing.delete({ where: { id: lGone.id } });
    const kept = await prisma.payment.findFirst({ where: { listingTitle: { startsWith: "Villa" }, userId: ownerA.id, listingId: null } });
    expectEqual("deleting a listing keeps its payment record", kept != null, true);

    // ===== the log never holds secrets =====
    const details = (await prisma.paymentEvent.findMany({ select: { detail: true } })).map((e) => e.detail).join("\n");
    expectEqual("event details carry no keys", /thawani-api-key|secret|THAWANI_API_KEY/i.test(details), false);
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    // Leave the test database as we found it.
    const users = { createdBy: { email: { startsWith: run } } };
    await prisma.paymentEvent.deleteMany({});
    await prisma.payment.deleteMany({ where: { user: { email: { startsWith: run } } } });
    await prisma.listing.deleteMany({ where: users });
    await prisma.property.deleteMany({ where: { neighborhoodId: hood.id } });
    await prisma.user.deleteMany({ where: { email: { startsWith: run } } });
    await prisma.agency.deleteMany({ where: { slug: { startsWith: run } } });
    await prisma.neighborhood.deleteMany({ where: { id: hood.id } });
    await prisma.city.deleteMany({ where: { id: city.id } });
    await prisma.governorate.deleteMany({ where: { id: gov.id } });
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} payment confirm test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll payment confirm tests passed.");
}

main();
