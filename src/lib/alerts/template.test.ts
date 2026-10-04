// The alert email template and the local outbox file. Pure — no database.
// Run with: tsx src/lib/alerts/template.test.ts (part of npm run test:unit).
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "opip-outbox-test-"));

import { buildAlertEmail, type AlertListing } from "./template";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    console.error(`FAIL ${label}`, detail ?? "");
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const base: Omit<AlertListing, "propertyId" | "titleEn"> = {
  titleAr: null,
  neighborhoodEn: "Al Mouj",
  neighborhoodAr: "الموج",
  type: "VILLA",
  bedrooms: 3,
  listingType: "SALE",
  rentPeriod: null,
  price: "350000.000",
  provenance: "USER_SUBMITTED",
  isSample: false,
};
const mk = (i: number, over: Partial<AlertListing> = {}): AlertListing => ({
  ...base,
  propertyId: `prop${i}`,
  titleEn: `Villa ${i}`,
  titleAr: `فيلا ${i}`,
  ...over,
});

const input = (locale: string, listings: AlertListing[], totalNew = listings.length) => ({
  locale,
  name: "My villas",
  userName: "Sara",
  listings,
  totalNew,
  baseUrl: "https://example.test/",
  query: "hood=al-mouj&type=VILLA",
});

// English
const en = buildAlertEmail(input("en", [mk(1)]));
check("en subject", en.subject === "New listings for “My villas”", en.subject);
check("en html is ltr", /<html lang="en" dir="ltr">/.test(en.html));
check("en plain text present", en.text.includes("Hello Sara,") && en.text.includes("Villa 1"));
check("en price + source label", en.text.replace(/\u00a0/g, " ").includes("Asking price: OMR 350,000") && en.text.includes("Source: User submitted"), en.text);
check("en listing link", en.text.includes("https://example.test/en/properties/prop1"));
check("en manage link is the account page", en.text.includes("https://example.test/en/account"));
check("en honesty line", en.text.includes("not valuations"));

// Arabic
const ar = buildAlertEmail(input("ar", [mk(1)]));
check("ar subject", ar.subject === "إعلانات جديدة لبحثك «My villas»", ar.subject);
check("ar html is rtl", /<html lang="ar" dir="rtl">/.test(ar.html) && /<table role="presentation" dir="rtl"/.test(ar.html));
check("ar every table is rtl", (ar.html.match(/<table /g) ?? []).length === (ar.html.match(/<table [^>]*dir="rtl"/g) ?? []).length);
check("ar uses Arabic title and neighbourhood", ar.text.includes("فيلا 1") && ar.text.includes("الموج"));
check("ar price has Latin digits", /350,000/.test(ar.text) && !/[٠-٩]/.test(ar.text), ar.text);
check("ar source label is Arabic", ar.text.includes("المصدر:"));
check("ar links under /ar/", ar.html.includes("https://example.test/ar/properties/prop1"));
check("ar plain text present", ar.text.length > 50 && !ar.text.includes("<"));
check("ar locale fallback to en for unknown", buildAlertEmail(input("fr", [mk(1)])).subject.startsWith("New listings"));

// Rent wording
const rentM = buildAlertEmail(input("en", [mk(2, { listingType: "RENT", rentPeriod: "MONTHLY", price: "450" })]));
const rentA = buildAlertEmail(input("ar", [mk(2, { listingType: "RENT", rentPeriod: "ANNUAL", price: "5400" })]));
check("rent per month", rentM.text.replace(/\u00a0/g, " ").includes("Asking rent: OMR 450 per month"), rentM.text);
check("rent per year (ar)", rentA.text.includes("سنويًا"));

// Hostile text is escaped in HTML
const evil = buildAlertEmail({
  ...input("en", [mk(3, { titleEn: `<script>alert("x")</script>`, neighborhoodEn: `"><img src=x>` })]),
  name: `<b>Hi</b>`,
  userName: `<i>Eve</i>`,
});
check("hostile html escaped", !evil.html.includes("<script>") && !evil.html.includes("<img") && !evil.html.includes("<b>Hi") && !evil.html.includes("<i>Eve"), evil.html);
check("hostile subject has no line breaks", !/[\r\n]/.test(buildAlertEmail({ ...input("en", [mk(1)]), name: "a\r\nBcc: x" }).subject));

// Sample listings never appear, even if passed in
const sampled = buildAlertEmail(input("en", [mk(4, { titleEn: "SAMPLE-HOME", isSample: true }), mk(5)]));
check("sample listing never shown", !sampled.text.includes("SAMPLE-HOME") && !sampled.html.includes("SAMPLE-HOME"));

// More than five
const many = buildAlertEmail(input("en", [1, 2, 3, 4, 5, 6, 7].map((i) => mk(i)), 12));
check("only 5 listings shown", (many.text.match(/View listing:/g) ?? []).length === 5);
check("…and N more + see all link", many.text.includes("…and 7 more.") && many.text.includes("https://example.test/en/properties?hood=al-mouj&type=VILLA"), many.text);

// Outbox file
async function outbox() {
  // Loaded now, after DATA_DIR is set (a static import would run first).
  const { buildEml, writeOutboxFile } = await import("../email/outbox");
  const file = await writeOutboxFile(
    { to: "a@b.test", subject: ar.subject, text: ar.text, html: ar.html },
    "../evil/../cmabc123",
  );
  const names = readdirSync(path.join(process.env.DATA_DIR!, "outbox"));
  check("one outbox file written", names.length === 1 && file.endsWith(names[0]));
  check("outbox name has no address or path tricks", /^[0-9TZ]+-evilcmabc123-[a-z0-9]+\.eml$/.test(names[0]), names[0]);
  const raw = readFileSync(file, "utf8");
  check("eml has text and html parts", raw.includes("text/plain") && raw.includes("text/html"));
  check("eml subject is encoded", /^Subject: =\?UTF-8\?B\?/m.test(raw));
  check("eml parts decode to the email", Buffer.from(raw.split("\r\n\r\n")[2].split("\r\n--")[0].replace(/\r\n/g, ""), "base64").toString("utf8") === ar.text);
  check("buildEml strips header line breaks", !/^Bcc:/m.test(buildEml({ to: "x@y.test\r\nBcc: z@y.test", subject: "s", text: "t" }, "b")));
}

outbox().then(() => {
  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
});
