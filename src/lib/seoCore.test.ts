// Share-preview text + head-tag tests. Run with: npm test
// The honesty rule: the only figure in a share preview is the ASKING price of a
// live, non-sample listing. Never an estimate, never a price without a live listing.
import {
  buildPageMetadata,
  buildPropertyShareText,
  isPropertyIndexable,
  pickCoverImage,
  shortDescription,
  type ShareTextInput,
} from "./seoCore";
import { formatOMRWhole } from "./money";

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL ${label}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const templates = {
  sale: "{type} in {area}, {city}. Asking price {price}.",
  rent: "{type} in {area}, {city}. Asking rent {price} {period}.",
  noPrice: "{type} in {area}, {city}.",
};
const baseInput: ShareTextInput = {
  locale: "en",
  templates,
  periodLabels: { MONTHLY: "per month", ANNUAL: "per year" },
  type: "Villa",
  area: "Al Khuwair",
  city: "Muscat",
  propertyIsSample: false,
  listings: [],
};
const hasDigit = (s: string) => /\d/.test(s);

// No listing -> no price.
check("no listing: no price and no digits", !hasDigit(buildPropertyShareText(baseInput)));
check("no listing: noPrice wording", buildPropertyShareText(baseInput) === "Villa in Al Khuwair, Muscat.");

// Not-live listings never supply a price.
for (const status of ["PENDING_REVIEW", "DRAFT", "REJECTED", "ARCHIVED", "SOLD", "RENTED"]) {
  const t = buildPropertyShareText({ ...baseInput, listings: [{ status, listingType: "SALE", price: 123456 }] });
  check(`${status} listing: no price`, !hasDigit(t));
}

// Live sale: the asking price through formatOMRWhole, and nothing else numeric.
{
  const t = buildPropertyShareText({ ...baseInput, listings: [{ status: "ACTIVE", listingType: "SALE", price: 123456.789 }] });
  check("live sale: uses formatOMRWhole", t.includes(formatOMRWhole(123456.789, "en")));
  check("live sale: says Asking", t.includes("Asking price"));
  const stripped = t.replace(formatOMRWhole(123456.789, "en"), "");
  check("live sale: no other figure", !hasDigit(stripped));
}

// Live rent: per-month and per-year wording.
{
  const m = buildPropertyShareText({ ...baseInput, listings: [{ status: "ACTIVE", listingType: "RENT", price: 450, rentPeriod: "MONTHLY" }] });
  const y = buildPropertyShareText({ ...baseInput, listings: [{ status: "ACTIVE", listingType: "RENT", price: 5400, rentPeriod: "ANNUAL" }] });
  check("live rent monthly wording", m.includes("per month") && m.includes("Asking rent"));
  check("live rent annual wording", y.includes("per year") && !y.includes("per month"));
}

// Newest ACTIVE listing wins (caller passes newest first); a not-live newer one is skipped.
{
  const t = buildPropertyShareText({
    ...baseInput,
    listings: [
      { status: "PENDING_REVIEW", listingType: "SALE", price: 999999 },
      { status: "ACTIVE", listingType: "SALE", price: 100000 },
      { status: "ACTIVE", listingType: "SALE", price: 200000 },
    ],
  });
  check("first live listing wins", t.includes(formatOMRWhole(100000, "en")) && !t.includes("999"));
}

// Sample records show no price at all.
check("sample property: no price", !hasDigit(buildPropertyShareText({ ...baseInput, propertyIsSample: true, listings: [{ status: "ACTIVE", listingType: "SALE", price: 100000 }] })));
check("sample listing: no price", !hasDigit(buildPropertyShareText({ ...baseInput, listings: [{ status: "ACTIVE", listingType: "SALE", price: 100000, isSample: true }] })));

// Arabic: Latin digits through the same formatter.
{
  const t = buildPropertyShareText({ ...baseInput, locale: "ar", listings: [{ status: "ACTIVE", listingType: "SALE", price: 250000 }] });
  check("arabic: price from formatOMRWhole", t.includes(formatOMRWhole(250000, "ar")));
}

// Garbage price never prints "NaN".
check("bad price: falls back to no price", !buildPropertyShareText({ ...baseInput, listings: [{ status: "ACTIVE", listingType: "SALE", price: "abc" }] }).includes("NaN"));

// Indexing rule.
check("indexable: live, real", isPropertyIndexable({ isSample: false, listings: [{ status: "ACTIVE" }] }));
check("not indexable: no live listing", !isPropertyIndexable({ isSample: false, listings: [{ status: "SOLD" }] }));
check("not indexable: no listings", !isPropertyIndexable({ isSample: false, listings: [] }));
check("not indexable: sample property", !isPropertyIndexable({ isSample: true, listings: [{ status: "ACTIVE" }] }));
check("not indexable: only sample listing", !isPropertyIndexable({ isSample: false, listings: [{ status: "ACTIVE", isSample: true }] }));

// Cover photo.
check("cover: primary wins", pickCoverImage([{ isPrimary: false, sortOrder: 0 }, { isPrimary: true, sortOrder: 5 }])?.sortOrder === 5);
check("cover: else lowest sort order", pickCoverImage([{ isPrimary: false, sortOrder: 3 }, { isPrimary: false, sortOrder: 1 }])?.sortOrder === 1);
check("cover: none", pickCoverImage([]) === null);

// Head tags.
{
  const m = buildPageMetadata({ base: "https://example.om", locale: "ar", path: "/market", title: "T", description: "D", siteName: "Site" });
  const alt = m.alternates as { canonical: string; languages: Record<string, string> };
  check("page canonical is the same language", alt.canonical === "https://example.om/ar/market");
  check("page language links incl. x-default", alt.languages.en === "https://example.om/en/market" && alt.languages.ar === "https://example.om/ar/market" && alt.languages["x-default"] === alt.languages.en);
  check("page language links never point at the home page", !Object.values(alt.languages).some((u) => u === "https://example.om/en" || u === "https://example.om/ar"));
  check("page og locale ar_OM", (m.openGraph as { locale: string }).locale === "ar_OM");
  check("no robots tag when indexable", m.robots === undefined);
  const home = buildPageMetadata({ base: "https://example.om", locale: "en", path: "/", description: "D", siteName: "Site" });
  check("home canonical", (home.alternates as { canonical: string }).canonical === "https://example.om/en");
  const noindex = buildPageMetadata({ base: "https://example.om", locale: "en", path: "/properties/x", title: "T", description: "D", siteName: "S", noindex: true, follow: true });
  check("noindex + follow", JSON.stringify(noindex.robots) === JSON.stringify({ index: false, follow: true }));
  const nobase = buildPageMetadata({ base: null, locale: "en", path: "/market", title: "T", description: "D", siteName: "S", image: { url: "x", alt: "a" } });
  check("no base: no canonical and no image addresses", nobase.alternates === undefined && (nobase.openGraph as { images?: unknown }).images === undefined);
}

// Description trimming.
check("shortDescription: short text unchanged", shortDescription("Hello  world") === "Hello world");
check("shortDescription: long text trimmed near 160", shortDescription("word ".repeat(100)).length <= 161);
check("shortDescription: empty", shortDescription(null) === "");

if (failures > 0) {
  console.error(`\n${failures} share-text test(s) failed`);
  process.exit(1);
}
console.log("\nAll share-text tests passed.");
