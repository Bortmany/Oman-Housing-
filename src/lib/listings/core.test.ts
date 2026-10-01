// Listing core — database-backed tests. Run with: npm test (uses the _test database).
// Two owners, two agencies, an admin: every action refuses a listing it does
// not own; the owner cap; the bytes check; edit-returns-to-review; never-public.
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Uploads go to a throwaway folder, set BEFORE storage.ts is loaded.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "opip-core-test-"));

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
  const rules = await import("./rules");
  const { inquiriesForOwnerListing } = await import("@/lib/db/inquiries");
  const { isPropertyPublicById, ownerContactForProperty } = await import("@/lib/db/listings");
  const { dataDir } = await import("@/lib/storage");

  const run = `ct${Date.now()}`;
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], "a.jpg");
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], "a.png");
  const webp = () => new File([Buffer.from("RIFF\0\0\0\0WEBPxxxx", "binary")], "a.webp");

  const gov = await prisma.governorate.create({ data: { slug: `${run}-g`, nameEn: "G", nameAr: "ح" } });
  const city = await prisma.city.create({ data: { slug: `${run}-c`, nameEn: "C", nameAr: "م", governorateId: gov.id } });
  const hood = await prisma.neighborhood.create({ data: { slug: `${run}-n`, nameEn: "N", nameAr: "ن", cityId: city.id } });
  const mkUser = (n: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email: `${run}-${n}@example.com`, ...extra } });
  const verified = { phone: "+968 91234567", phoneVerifiedAt: new Date() };
  const ownerA = await mkUser("a", { ...verified });
  const ownerB = await mkUser("b", { phone: "+968 92345678", phoneVerifiedAt: new Date() });
  const unverified = await mkUser("u");
  const admin = await mkUser("admin", { role: "ADMIN" });
  const agX = await prisma.agency.create({ data: { slug: `${run}-x`, nameEn: "X", isApproved: true } });
  const agY = await prisma.agency.create({ data: { slug: `${run}-y`, nameEn: "Y", isApproved: true } });
  const userX = await mkUser("x", { role: "AGENCY", agencyId: agX.id });
  const userY = await mkUser("y", { role: "AGENCY", agencyId: agY.id });
  type TestActor = { userId: string; agencyId: string | null };
  const A: TestActor = { userId: ownerA.id, agencyId: null };
  const B: TestActor = { userId: ownerB.id, agencyId: null };
  const X: TestActor = { userId: userX.id, agencyId: agX.id };
  const Y: TestActor = { userId: userY.id, agencyId: agY.id };
  const U: TestActor = { userId: unverified.id, agencyId: null };

  const values = (over: Record<string, string> = {}) => ({
    neighborhoodId: hood.id, type: "VILLA", ownership: "FOREIGN_ITC", titleEn: "Villa", titleAr: "فيلا",
    listingType: "SALE", price: "185000", ...over,
  });
  const mk = async (actor: TestActor, over: Record<string, string> = {}) => {
    const r = await core.saveListing(actor, { values: values(over) });
    if (!r.ok) throw new Error(`setup failed: ${r.error}`);
    return r.listingId;
  };
  const statusOf = async (id: string) => (await prisma.listing.findUnique({ where: { id } }))?.status;
  const photosOf = (id: string) =>
    prisma.propertyImage.count({ where: { property: { listings: { some: { id } } } } });

  try {
    // ----- creating -----
    expectEqual("unverified owner cannot start a listing", (await core.saveListing(U, { values: values() })).ok, false);
    const idA = await mk(A);
    const created = await prisma.listing.findUnique({ where: { id: idA }, include: { property: true } });
    expectEqual("owner listing starts as a draft", created?.status, "DRAFT");
    expectEqual("owner listing has no agency", created?.agencyId, null);
    expectEqual("created by the owner", created?.createdById, ownerA.id);
    expectEqual("listing is user-submitted, never verified", created?.provenance, "USER_SUBMITTED");
    expectEqual("property is user-submitted, never verified", created?.property.provenance, "USER_SUBMITTED");
    expectEqual("property carries the owner note", created?.property.sourceNote, rules.OWNER_SOURCE_NOTE);
    expectEqual("dropdowns kept as chosen", [created?.property.type, created?.property.ownership], ["VILLA", "FOREIGN_ITC"]);

    // ----- a rejected save returns ALL failing fields and the typed values -----
    const rej = await core.saveListing(A, {
      values: values({ price: "-5", titleEn: "", type: "VILLA", ownership: "FOREIGN_ITC", neighborhoodId: hood.id }),
    });
    expectEqual("rejected save", rej.ok, false);
    if (!rej.ok) {
      expectEqual("all failing boxes named", Object.keys(rej.fieldErrors ?? {}).sort(), ["price", "titleEn"]);
      expectEqual("dropdown values handed back", [rej.values?.type, rej.values?.ownership, rej.values?.neighborhoodId],
        ["VILLA", "FOREIGN_ITC", hood.id]);
    }
    const forged = await core.saveListing(A, { values: values({ neighborhoodId: "nope" }) });
    expectEqual("forged neighbourhood refused", !forged.ok && forged.error, "validationFailed");

    // ----- draft cap (3), drafts never count against the slots -----
    const d2 = await mk(A);
    const d3 = await mk(A);
    const d4 = await core.saveListing(A, { values: values() });
    expectEqual("4th unfinished draft refused", !d4.ok && d4.error, "draftLimit");
    expectEqual("drafts use no slots", await core.slotsUsed(A), 0);

    // Five new drafts fired at once by a fresh owner: only the cap (3) get in.
    const ownerD = await mkUser("d", { phone: "+968 93456789", phoneVerifiedAt: new Date() });
    const D: TestActor = { userId: ownerD.id, agencyId: null };
    const burst = await Promise.all(Array.from({ length: 5 }, () => core.saveListing(D, { values: values() })));
    expectEqual("5 drafts at once: only the cap get in", burst.filter((r) => r.ok).length, rules.OWNER_DRAFT_CAP);
    expectEqual("the rest told draftLimit", burst.filter((r) => !r.ok && r.error === "draftLimit").length, 5 - rules.OWNER_DRAFT_CAP);

    // ----- bytes check, size, count -----
    const fake = await core.addPhoto(A, idA, new File(["#!/bin/sh\necho hi"], "evil.jpg", { type: "image/jpeg" }));
    expectEqual("text file renamed .jpg refused by its bytes", !fake.ok && fake.error, "photoType");
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    const tooBig = await core.addPhoto(A, idA, new File([big], "big.jpg"));
    expectEqual("5 MB + 1 refused", !tooBig.ok && tooBig.error, "photoSize");
    expectEqual("nothing saved after refusals", await photosOf(idA), 0);
    const p1 = await core.addPhoto(A, idA, jpeg());
    const p2 = await core.addPhoto(A, idA, png());
    const p3 = await core.addPhoto(A, idA, webp());
    expectEqual("jpeg, png, webp accepted", [p1.ok, p2.ok, p3.ok], [true, true, true]);
    if (p1.ok) {
      const abs = path.resolve(dataDir(), p1.image.path);
      expectEqual("saved inside DATA_DIR", abs.startsWith(dataDir() + path.sep) && existsSync(abs), true);
    }
    const imgs = await prisma.propertyImage.findMany({ where: { property: { listings: { some: { id: idA } } } }, orderBy: { sortOrder: "asc" } });
    expectEqual("first photo is the cover", imgs.map((i) => i.isPrimary), [true, false, false]);
    for (let i = 3; i < rules.MAX_PHOTOS; i++) await core.addPhoto(A, idA, jpeg());
    const sixteenth = await core.addPhoto(A, idA, jpeg());
    expectEqual("16th photo refused", !sixteenth.ok && sixteenth.error, "photoLimit");

    // ----- cover / order -----
    const ids = imgs.map((i) => i.id);
    await core.movePhoto(A, idA, ids[2], "cover");
    const after = await prisma.propertyImage.findMany({ where: { property: { listings: { some: { id: idA } } } }, orderBy: { sortOrder: "asc" } });
    expectEqual("make cover moves it first", [after[0].id, after[0].isPrimary], [ids[2], true]);
    expectEqual("only one cover", after.filter((i) => i.isPrimary).length, 1);
    expectEqual("order with a foreign id refused", (await core.setPhotoOrder(A, idA, ["x", ...ids])).ok, false);

    // ----- ownership: nobody else can touch it -----
    const adminListing = await prisma.property.create({
      data: {
        neighborhoodId: hood.id, type: "VILLA", titleEn: "Admin home",
        listings: { create: { listingType: "SALE", price: 1, status: "ACTIVE", createdById: admin.id } },
      },
      select: { listings: { select: { id: true } } },
    });
    const adminListingId = adminListing.listings[0].id;
    const idX = await mk(X);
    const imgA = after[1].id;
    const foreign: Array<[string, TestActor, string]> = [
      ["owner B on owner A's listing", B, idA],
      ["agency X on owner A's listing", X, idA],
      ["owner A on agency X's listing", A, idX],
      ["agency Y on agency X's listing", Y, idX],
      ["owner A on an admin-entered listing", A, adminListingId],
    ];
    for (const [label, actor, target] of foreign) {
      const before = { status: await statusOf(target), photos: await photosOf(target) };
      const results = [
        await core.saveListing(actor, { listingId: target, values: values({ price: "1" }) }),
        await core.addPhoto(actor, target, jpeg()),
        await core.removePhoto(actor, target, imgA),
        await core.setPhotoOrder(actor, target, ids),
        await core.movePhoto(actor, target, imgA, "cover"),
        await core.describePhoto(actor, target, imgA, { altEn: "x", altAr: "y" }),
        await core.sendForReview(actor, target, { confirmations: { owner: true, phone: true } }),
        await core.takeDown(actor, target, "WITHDRAW"),
        await core.deleteDraft(actor, target),
      ];
      expectEqual(`${label}: every action says notFound`, results.map((r) => (r.ok ? "ok" : r.error)), results.map(() => "notFound"));
      expectEqual(`${label}: nothing changed`, { status: await statusOf(target), photos: await photosOf(target) }, before);
    }
    expectEqual("another owner's page query finds nothing", await core.listingForActor(B, idA), null);
    expectEqual("a missing id looks the same", await core.listingForActor(B, "doesnotexist"), null);
    const foreignImage = await core.removePhoto(A, d2, imgA); // photo of listing A via a different (own) listing
    expectEqual("a photo id from another listing is refused", !foreignImage.ok && foreignImage.error, "notFound");

    // ----- sending for review: needs photo + ticks; the cap of 3 -----
    expectEqual("no photo: refused", (await core.sendForReview(A, d2, { confirmations: { owner: true, phone: true } })), { ok: false, error: "photoRequired" });
    expectEqual("ticks missing: refused", (await core.sendForReview(A, idA, { confirmations: { owner: true, phone: false } })), { ok: false, error: "confirmRequired" });
    await core.addPhoto(A, d2, jpeg());
    await core.addPhoto(A, d3, jpeg());
    const ticks = { confirmations: { owner: true, phone: true } };
    expectEqual("1st send", (await core.sendForReview(A, idA, ticks)).ok, true);
    expectEqual("2nd send", (await core.sendForReview(A, d2, ticks)).ok, true);
    expectEqual("3rd send", (await core.sendForReview(A, d3, ticks)).ok, true);
    expectEqual("3 slots used", await core.slotsUsed(A), 3);
    const d5 = await mk(A);
    await core.addPhoto(A, d5, jpeg());
    expectEqual("4th live-or-in-review refused", !(await core.sendForReview(A, d5, ticks)).ok, true);
    expectEqual("…with the cap message", (await core.sendForReview(A, d5, ticks)), { ok: false, error: "capReached" });
    expectEqual("two clicks at once cannot both pass", (await Promise.all([core.sendForReview(A, d5, ticks), core.sendForReview(A, d5, ticks)])).filter((r) => r.ok).length, 0);
    expectEqual("withdraw frees a slot", (await core.takeDown(A, d3, "WITHDRAW")).ok, true);
    expectEqual("then the 4th goes", (await core.sendForReview(A, d5, ticks)).ok, true);
    expectEqual("owner can't remove the last photo of an in-review listing",
      (await core.removePhoto(A, d5, (await prisma.propertyImage.findFirstOrThrow({ where: { property: { listings: { some: { id: d5 } } } } })).id)), { ok: false, error: "lastPhoto" });

    // ----- never public until reviewed -----
    const propOf = async (id: string) => (await prisma.listing.findUniqueOrThrow({ where: { id } })).propertyId;
    expectEqual("in-review home is not public", await isPropertyPublicById(await propOf(idA)), false);
    expectEqual("draft-only home is not public", await isPropertyPublicById(await propOf(d3)), false);
    expectEqual("admin reference record (live) is public", await isPropertyPublicById(await propOf(adminListingId)), true);
    const bare = await prisma.property.create({ data: { neighborhoodId: hood.id, type: "LAND", titleEn: "Bare" } });
    expectEqual("home with no listings stays public", await isPropertyPublicById(bare.id), true);
    const visible = await prisma.property.findMany({ where: { neighborhoodId: hood.id, ...rules.publicPropertyWhere }, select: { id: true } });
    expectEqual("neighbourhood list leaves out unreviewed homes", visible.map((p) => p.id).sort(), [bare.id, await propOf(adminListingId)].sort());

    // admin approves A's first listing
    await prisma.listing.update({ where: { id: idA }, data: { status: "ACTIVE", publishedAt: new Date() } });
    expectEqual("published home is public", await isPropertyPublicById(await propOf(idA)), true);
    expectEqual("verified owner phone shows as contact", (await ownerContactForProperty(await propOf(idA)))?.phone, "+968 91234567");

    // ----- edit returns to review -----
    expectEqual("no-change save keeps it live", (await core.saveListing(A, { listingId: idA, values: values() })), { ok: true, listingId: idA, status: "ACTIVE", changed: false });
    expectEqual("reorder keeps it live", [(await core.movePhoto(A, idA, ids[0], "cover")).ok, await statusOf(idA)], [true, "ACTIVE"]);
    expectEqual("remove a photo keeps it live", [(await core.removePhoto(A, idA, ids[1])).ok, await statusOf(idA)], [true, "ACTIVE"]);
    const edited = await core.saveListing(A, { listingId: idA, values: values({ price: "190000" }) });
    expectEqual("price change returns to review", edited.ok && edited.status, "PENDING_REVIEW");
    expectEqual("…and the home is hidden again", await isPropertyPublicById(await propOf(idA)), false);
    expectEqual("…keeping its old published date", (await prisma.listing.findUniqueOrThrow({ where: { id: idA } })).publishedAt !== null, true);
    await prisma.listing.update({ where: { id: idA }, data: { status: "ACTIVE" } });
    await core.addPhoto(A, idA, jpeg());
    expectEqual("a photo added to a live listing returns it to review", await statusOf(idA), "PENDING_REVIEW");

    // ----- sold / rented / resubmit / delete draft -----
    await prisma.listing.update({ where: { id: idA }, data: { status: "ACTIVE" } });
    expectEqual("'rented' refused for a sale", !(await core.takeDown(A, idA, "RENTED")).ok, true);
    expectEqual("sold works for a sale", (await core.takeDown(A, idA, "SOLD")).ok, true);
    expectEqual("sold listing can be sent again", (await core.sendForReview(A, idA)).ok, true);
    expectEqual("only drafts can be deleted", !(await core.deleteDraft(A, idA)).ok, true);
    const dd = await mk(A);
    expectEqual("draft deletes", (await core.deleteDraft(A, dd)).ok, true);
    expectEqual("…and is gone", await prisma.listing.findUnique({ where: { id: dd } }), null);

    // ----- owner enquiries are only the owner's own -----
    const propA = await propOf(idA);
    await prisma.listing.update({ where: { id: idA }, data: { status: "ACTIVE" } });
    await prisma.inquiry.create({ data: { listingId: idA, name: "Buyer", email: "b@example.com", message: "hi" } });
    await prisma.inquiry.create({ data: { listingId: idX, name: "Other", email: "o@example.com", message: "yo" } });
    expectEqual("owner sees the enquiry on their listing", (await inquiriesForOwnerListing(ownerA.id, idA)).length, 1);
    expectEqual("another owner sees none", (await inquiriesForOwnerListing(ownerB.id, idA)).length, 0);
    expectEqual("owner cannot read an agency listing's enquiries", (await inquiriesForOwnerListing(ownerA.id, idX)).length, 0);
    void propA;
  } finally {
    // Clean up everything this run created.
    const users = await prisma.user.findMany({ where: { email: { startsWith: run } }, select: { id: true } });
    const uids = users.map((u) => u.id);
    const listings = await prisma.listing.findMany({ where: { createdById: { in: uids } }, select: { id: true, propertyId: true } });
    const adminProps = await prisma.property.findMany({ where: { neighborhood: { slug: `${run}-n` } }, select: { id: true } });
    await prisma.inquiry.deleteMany({ where: { listingId: { in: listings.map((l) => l.id) } } });
    await prisma.listing.deleteMany({ where: { propertyId: { in: adminProps.map((p) => p.id) } } });
    await prisma.property.deleteMany({ where: { id: { in: adminProps.map((p) => p.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.agency.deleteMany({ where: { slug: { startsWith: run } } });
    await prisma.neighborhood.deleteMany({ where: { slug: `${run}-n` } });
    await prisma.city.deleteMany({ where: { slug: `${run}-c` } });
    await prisma.governorate.deleteMany({ where: { slug: `${run}-g` } });
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} listing-core test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll listing-core tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
