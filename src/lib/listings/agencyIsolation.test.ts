// Agency isolation — database-backed. Run with: npm test (uses the _test database).
// What the agency listing pages and actions rely on: agency B cannot open or
// edit agency A's listing, a private owner cannot open an agency listing, and a
// home an admin has verified is reported as locked for editing.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "opip-agency-test-"));

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

  const run = `ag${Date.now()}`;
  const gov = await prisma.governorate.create({ data: { slug: `${run}-g`, nameEn: "G", nameAr: "ح" } });
  const city = await prisma.city.create({ data: { slug: `${run}-c`, nameEn: "C", nameAr: "م", governorateId: gov.id } });
  const hood = await prisma.neighborhood.create({ data: { slug: `${run}-n`, nameEn: "N", nameAr: "ن", cityId: city.id } });
  const mkUser = (n: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email: `${run}-${n}@example.com`, ...extra } });
  const owner = await mkUser("owner", { phone: "+968 91234567", phoneVerifiedAt: new Date() });
  const agA = await prisma.agency.create({ data: { slug: `${run}-a`, nameEn: "A", isApproved: true } });
  const agB = await prisma.agency.create({ data: { slug: `${run}-b`, nameEn: "B", isApproved: true } });
  const userA = await mkUser("ua", { role: "AGENCY", agencyId: agA.id });
  const userB = await mkUser("ub", { role: "AGENCY", agencyId: agB.id });
  const O = { userId: owner.id, agencyId: null };
  const A = { userId: userA.id, agencyId: agA.id };
  const B = { userId: userB.id, agencyId: agB.id };

  const values = (over: Record<string, string> = {}) => ({
    neighborhoodId: hood.id, type: "APARTMENT", ownership: "UNKNOWN", titleEn: "Flat",
    listingType: "SALE", price: "90000", ...over,
  });

  try {
    const made = await core.saveListing(A, { values: values() });
    if (!made.ok) throw new Error(`setup failed: ${made.error}`);
    const id = made.listingId;

    // ----- opening -----
    expectEqual("agency A opens its own listing", (await core.listingForActor(A, id))?.id, id);
    expectEqual("agency B cannot open agency A's listing", await core.listingForActor(B, id), null);
    expectEqual("a private owner cannot open an agency listing", await core.listingForActor(O, id), null);
    expectEqual("a missing id answers the same", await core.listingForActor(B, "does-not-exist"), null);

    // ----- editing -----
    const bEdit = await core.saveListing(B, { listingId: id, values: values({ price: "1" }) });
    expectEqual("agency B cannot edit agency A's listing", !bEdit.ok && bEdit.error, "notFound");
    const oEdit = await core.saveListing(O, { listingId: id, values: values({ price: "1" }) });
    expectEqual("a private owner cannot edit an agency listing", !oEdit.ok && oEdit.error, "notFound");
    const row = await prisma.listing.findUnique({ where: { id } });
    expectEqual("the price was not changed by the refused edits", Number(row?.price), 90000);

    // ----- the other actions -----
    expectEqual("agency B cannot send it for review", (await core.sendForReview(B, id, { freeLaunch: true })).ok, false);
    expectEqual("agency B cannot delete it", (await core.deleteDraft(B, id)).ok, false);
    expectEqual("it is still there", Boolean(await core.listingForActor(A, id)), true);
    const sent = await core.sendForReview(A, id, { freeLaunch: true });
    expectEqual("agency A can send it for review", sent.ok, true);
    expectEqual("agency B cannot take it down", (await core.takeDown(B, id, "WITHDRAW")).ok, false);
    expectEqual("still in review after B's attempt", (await prisma.listing.findUnique({ where: { id } }))?.status, "PENDING_REVIEW");
    expectEqual("agency A can withdraw it", (await core.takeDown(A, id, "WITHDRAW")).ok, true);
    expectEqual("agency B's list does not include it", (await core.listingsForActor(B)).length, 0);

    // ----- a home an admin verified cannot be edited, but the listing can still be taken down -----
    const seeded = await prisma.property.create({
      data: {
        neighborhoodId: hood.id, type: "VILLA", titleEn: "Verified home", verifiedAt: new Date(),
        listings: { create: { listingType: "SALE", price: 100000, status: "ACTIVE", agencyId: agA.id, createdById: userA.id } },
      },
      include: { listings: true },
    });
    const sid = seeded.listings[0].id;
    expectEqual("verified home reported as locked", await core.homeEditLocked(A, sid), true);
    expectEqual("another agency is told nothing (not locked, not theirs)", await core.homeEditLocked(B, sid), false);
    const locked = await core.saveListing(A, { listingId: sid, values: values() });
    expectEqual("saving a verified home is refused", !locked.ok && locked.error, "wrongState");
    expectEqual("own listing on an unverified home is not locked", await core.homeEditLocked(A, id), false);
    expectEqual("marking a verified-home listing sold still works", (await core.takeDown(A, sid, "SOLD")).ok, true);
  } finally {
    // Clean up everything this run created.
    const props = await prisma.property.findMany({ where: { neighborhood: { slug: `${run}-n` } }, select: { id: true } });
    const pids = props.map((p) => p.id);
    await prisma.listing.deleteMany({ where: { propertyId: { in: pids } } });
    await prisma.propertyImage.deleteMany({ where: { propertyId: { in: pids } } });
    await prisma.property.deleteMany({ where: { id: { in: pids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: run } } });
    await prisma.agency.deleteMany({ where: { slug: { startsWith: run } } });
    await prisma.neighborhood.deleteMany({ where: { slug: `${run}-n` } });
    await prisma.city.deleteMany({ where: { slug: `${run}-c` } });
    await prisma.governorate.deleteMany({ where: { slug: `${run}-g` } });
    await prisma.$disconnect();
  }
  if (failures > 0) {
    console.error(`\n${failures} agency isolation test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll agency isolation tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
