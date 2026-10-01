// Listing rules — pure logic. Run with: npm test
import type { ListingStatus } from "@prisma/client";
import {
  AGENCY_DRAFT_CAP,
  MAX_PHOTOS,
  OWNER_DRAFT_CAP,
  OWNER_LISTING_CAP,
  canDeleteDraft,
  canSendForReview,
  contentChanged,
  draftCapFor,
  isOwnersFirstListing,
  isPropertyPublic,
  isSameIdSet,
  mayRemoveLastPhoto,
  ownerHasSlot,
  ownershipWhere,
  ownsListing,
  reorderIds,
  statusAfterPhotoAdded,
  statusAfterSave,
  takeDownStatus,
  underDraftCap,
  validateListingValues,
  type ListingContent,
  type SavedContent,
} from "./rules";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

// --- who owns a listing ---
const owner = { userId: "u1", agencyId: null };
const otherOwner = { userId: "u2", agencyId: null };
const agencyA = { userId: "u3", agencyId: "A" };
const agencyB = { userId: "u4", agencyId: "B" };
const ownerListing = { agencyId: null, createdById: "u1" };
const agencyListing = { agencyId: "A", createdById: "u3" };
const adminEntered = { agencyId: null, createdById: "admin" };
expectEqual("owner owns own listing", ownsListing(owner, ownerListing), true);
expectEqual("another owner does not", ownsListing(otherOwner, ownerListing), false);
expectEqual("an agency does not own an owner's listing", ownsListing(agencyA, ownerListing), false);
expectEqual("agency owns its listing", ownsListing(agencyA, agencyListing), true);
expectEqual("agency colleague (same agency) owns it", ownsListing({ userId: "u9", agencyId: "A" }, agencyListing), true);
expectEqual("another agency does not", ownsListing(agencyB, agencyListing), false);
expectEqual("an owner does not own an agency listing", ownsListing(owner, agencyListing), false);
expectEqual("admin-entered listing belongs to nobody (owner)", ownsListing(owner, adminEntered), false);
expectEqual("admin-entered listing belongs to nobody (agency)", ownsListing(agencyA, adminEntered), false);
expectEqual("owner filter", ownershipWhere(owner), { agencyId: null, createdById: "u1" });
expectEqual("agency filter", ownershipWhere(agencyA), { agencyId: "A" });

// --- the form: every failing box is named, values come back ---
const good = {
  neighborhoodId: "n1", type: "VILLA", ownership: "FOREIGN_ITC",
  titleEn: "Villa in Al Khuwair", titleAr: "فيلا في الخوير", descriptionEn: "Quiet street",
  descriptionAr: "شارع هادئ", bedrooms: "4", bathrooms: "3", areaSqm: "320", yearBuilt: "2019",
  listingType: "SALE", price: "185,000", rentPeriod: "",
};
const okParsed = validateListingValues(good);
expectEqual("a good form passes", okParsed.ok, true);
if (okParsed.ok) {
  expectEqual("price commas stripped", okParsed.data.price, 185000);
  expectEqual("sale has no rent period", okParsed.data.rentPeriod, null);
  expectEqual("ownership kept", okParsed.data.ownership, "FOREIGN_ITC");
  expectEqual("type kept", okParsed.data.type, "VILLA");
}
const arabicDigits = validateListingValues({ ...good, price: "١٨٥٠٠٠", bedrooms: "٤" });
expectEqual("Arabic-Indic digits accepted", arabicDigits.ok && arabicDigits.data.price, 185000);

const bad = validateListingValues({
  ...good, neighborhoodId: "", titleEn: "", price: "-5", bedrooms: "abc", yearBuilt: "1500", type: "CASTLE",
});
expectEqual("a bad form is refused", bad.ok, false);
if (!bad.ok) {
  expectEqual("ALL failing boxes named",
    Object.keys(bad.errors).sort(),
    ["bedrooms", "neighborhoodId", "price", "titleEn", "type", "yearBuilt"]);
  expectEqual("negative price says pricePositive", bad.errors.price?.key, "pricePositive");
  expectEqual("empty title says required", bad.errors.titleEn?.key, "required");
  expectEqual("year 1500 says yearRange", bad.errors.yearBuilt?.key, "yearRange");
  expectEqual("text in a number box says number", bad.errors.bedrooms?.key, "number");
  expectEqual("unknown type says invalidChoice", bad.errors.type?.key, "invalidChoice");
}
const negOnly = validateListingValues({ ...good, price: "-1" });
expectEqual("only the price fails for a negative price", !negOnly.ok && Object.keys(negOnly.errors), ["price"]);
const zero = validateListingValues({ ...good, price: "0" });
expectEqual("zero price refused", zero.ok, false);
const longTitle = validateListingValues({ ...good, titleEn: "x".repeat(201) });
expectEqual("over-long title refused with its max", !longTitle.ok && longTitle.errors.titleEn, { key: "tooLong", max: 200 });
const rent = validateListingValues({ ...good, listingType: "RENT", rentPeriod: "ANNUAL" });
expectEqual("rent period kept for rent", rent.ok && rent.data.rentPeriod, "ANNUAL");
const rentDefault = validateListingValues({ ...good, listingType: "RENT", rentPeriod: "" });
expectEqual("rent defaults to monthly", rentDefault.ok && rentDefault.data.rentPeriod, "MONTHLY");
const hugePrice = validateListingValues({ ...good, price: "99999999999" });
expectEqual("price beyond the column refused", hugePrice.ok, false);

// --- edit returns to review ---
const saved: SavedContent = {
  neighborhoodId: "n1", type: "VILLA", ownership: "FOREIGN_ITC", titleEn: "Villa in Al Khuwair",
  titleAr: "فيلا في الخوير", descriptionEn: "Quiet street", descriptionAr: "شارع هادئ",
  bedrooms: 4, bathrooms: 3, areaSqm: 320, yearBuilt: 2019, listingType: "SALE", price: 185000, rentPeriod: null,
};
const same = (okParsed.ok ? okParsed.data : null) as ListingContent;
expectEqual("no change is not a change", contentChanged(saved, same), false);
expectEqual("price change is a change", contentChanged(saved, { ...same, price: 190000 }), true);
expectEqual("title change is a change", contentChanged(saved, { ...same, titleEn: "Villa" }), true);
expectEqual("ownership change is a change", contentChanged(saved, { ...same, ownership: "OMANI_ONLY" }), true);
expectEqual("type change is a change", contentChanged(saved, { ...same, type: "APARTMENT" }), true);
expectEqual("Arabic description change is a change", contentChanged(saved, { ...same, descriptionAr: "x" }), true);
expectEqual("live + changed -> back to review", statusAfterSave("ACTIVE", true), "PENDING_REVIEW");
expectEqual("live + unchanged stays live", statusAfterSave("ACTIVE", false), "ACTIVE");
expectEqual("pending stays pending", statusAfterSave("PENDING_REVIEW", true), "PENDING_REVIEW");
expectEqual("draft stays draft", statusAfterSave("DRAFT", true), "DRAFT");
expectEqual("rejected stays rejected on edit", statusAfterSave("REJECTED", true), "REJECTED");
expectEqual("photo added on a live listing -> review", statusAfterPhotoAdded("ACTIVE"), "PENDING_REVIEW");
expectEqual("photo added to a draft stays a draft", statusAfterPhotoAdded("DRAFT"), "DRAFT");

// --- the state table ---
const statuses: ListingStatus[] = ["DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED", "SOLD", "RENTED", "ARCHIVED"];
expectEqual("send for review from", statuses.filter(canSendForReview), ["DRAFT", "REJECTED", "SOLD", "RENTED", "ARCHIVED"]);
expectEqual("withdraw a live listing", takeDownStatus("ACTIVE", "SALE", "WITHDRAW"), "ARCHIVED");
expectEqual("sold (sale)", takeDownStatus("ACTIVE", "SALE", "SOLD"), "SOLD");
expectEqual("sold is refused for a rental", takeDownStatus("ACTIVE", "RENT", "SOLD"), null);
expectEqual("rented (rent)", takeDownStatus("ACTIVE", "RENT", "RENTED"), "RENTED");
expectEqual("rented is refused for a sale", takeDownStatus("ACTIVE", "SALE", "RENTED"), null);
expectEqual("withdraw an in-review listing", takeDownStatus("PENDING_REVIEW", "SALE", "WITHDRAW"), "ARCHIVED");
expectEqual("an in-review listing cannot be 'sold'", takeDownStatus("PENDING_REVIEW", "SALE", "SOLD"), null);
expectEqual("a draft cannot be taken down", takeDownStatus("DRAFT", "SALE", "WITHDRAW"), null);
expectEqual("a rejected listing cannot be taken down", takeDownStatus("REJECTED", "SALE", "WITHDRAW"), null);
expectEqual("only drafts can be deleted", statuses.filter(canDeleteDraft), ["DRAFT"]);

// --- caps ---
expectEqual("owner cap is 3", OWNER_LISTING_CAP, 3);
expectEqual("2 in play leaves a slot", ownerHasSlot(2), true);
expectEqual("3 in play: no slot", ownerHasSlot(3), false);
expectEqual("owner draft cap", draftCapFor(owner), OWNER_DRAFT_CAP);
expectEqual("agency draft cap", draftCapFor(agencyA), AGENCY_DRAFT_CAP);
expectEqual("3 owner drafts: no more", underDraftCap(owner, 3), false);
expectEqual("2 owner drafts: one more ok", underDraftCap(owner, 2), true);
expectEqual("agency may hold 9 drafts", underDraftCap(agencyA, 9), true);
expectEqual("agency at 10 drafts: no more", underDraftCap(agencyA, 10), false);
expectEqual("photo cap is 15", MAX_PHOTOS, 15);

// --- the first-listing flag ---
expectEqual("never published = first listing", isOwnersFirstListing(0), true);
expectEqual("one published before = not first", isOwnersFirstListing(1), false);

// --- unreviewed content is never public ---
expectEqual("no listings = public (admin record)", isPropertyPublic([]), true);
expectEqual("only pending = hidden", isPropertyPublic(["PENDING_REVIEW"]), false);
expectEqual("only draft = hidden", isPropertyPublic(["DRAFT"]), false);
expectEqual("only rejected = hidden", isPropertyPublic(["REJECTED"]), false);
expectEqual("only withdrawn = hidden", isPropertyPublic(["ARCHIVED"]), false);
expectEqual("sold + rented = hidden", isPropertyPublic(["SOLD", "RENTED"]), false);
expectEqual("one live listing = public", isPropertyPublic(["PENDING_REVIEW", "ACTIVE"]), true);

// --- photos ---
expectEqual("make cover", reorderIds(["a", "b", "c"], "c", "cover"), ["c", "a", "b"]);
expectEqual("move earlier", reorderIds(["a", "b", "c"], "c", "earlier"), ["a", "c", "b"]);
expectEqual("move later", reorderIds(["a", "b", "c"], "a", "later"), ["b", "a", "c"]);
expectEqual("first cannot move earlier", reorderIds(["a", "b"], "a", "earlier"), ["a", "b"]);
expectEqual("unknown photo", reorderIds(["a", "b"], "z", "cover"), null);
expectEqual("same id set", isSameIdSet(["a", "b"], ["b", "a"]), true);
expectEqual("extra id refused", isSameIdSet(["a", "b"], ["a", "b", "c"]), false);
expectEqual("repeated id refused", isSameIdSet(["a", "b"], ["a", "a"]), false);
expectEqual("owner can't drop the last photo of a live listing", mayRemoveLastPhoto(owner, "ACTIVE"), false);
expectEqual("owner can't drop the last photo of an in-review listing", mayRemoveLastPhoto(owner, "PENDING_REVIEW"), false);
expectEqual("owner can on a draft", mayRemoveLastPhoto(owner, "DRAFT"), true);
expectEqual("agency may (no minimum)", mayRemoveLastPhoto(agencyA, "ACTIVE"), true);

if (failures > 0) {
  console.error(`\n${failures} listing-rule test(s) failed`);
  process.exit(1);
}
console.log("\nAll listing-rule tests passed");
