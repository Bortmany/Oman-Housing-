// Payments — the pure parts: baisa maths, the price reader, reading the
// gateway's answer, and the "paid placement never leaks into estimates or the
// AI analyst" scan. Run with: npm test
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { baisaToAmount, toBaisa } from "./baisa";
import {
  PRICE_DEFAULTS,
  PRICE_KEYS,
  amountOrDefault,
  daysOrDefault,
  featuredPriceFor,
  parseDays,
  parsePriceAmount,
} from "./priceCore";
import { parseSessionAnswer, parseThawaniEnv, payPageUrl } from "./thawaniCore";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

// ----- baisa maths: integer, from the text of the amount -----
expectEqual("3.000 -> 3000", toBaisa("3.000"), 3000);
expectEqual("6.000 -> 6000", toBaisa("6.000"), 6000);
expectEqual("0.001 -> 1", toBaisa("0.001"), 1);
expectEqual("3 -> 3000", toBaisa("3"), 3000);
expectEqual("3.5 -> 3500", toBaisa("3.5"), 3500);
expectEqual("0.000 -> 0", toBaisa("0.000"), 0);
expectEqual("number 4.5 -> 4500", toBaisa(4.5), 4500);
expectEqual("1234.567 -> 1234567", toBaisa("1234.567"), 1234567);
expectEqual("float dust is not a problem (0.1+0.2 text)", toBaisa(String(0.1 + 0.2)), null); // 0.30000000000000004: more than 3 decimals, refused
expectEqual("refuses 4 decimals", toBaisa("3.0001"), null);
expectEqual("refuses negative", toBaisa("-3.000"), null);
expectEqual("refuses NaN", toBaisa(NaN), null);
expectEqual("refuses Infinity", toBaisa(Infinity), null);
expectEqual("refuses junk", toBaisa("abc"), null);
expectEqual("refuses empty", toBaisa(""), null);
expectEqual("refuses exponent form", toBaisa("1e3"), null);
expectEqual("refuses comma", toBaisa("3,000"), null);
expectEqual("baisaToAmount 3000 -> 3.000", baisaToAmount(3000), "3.000");
expectEqual("baisaToAmount 1 -> 0.001", baisaToAmount(1), "0.001");
expectEqual("baisaToAmount 4500 -> 4.500", baisaToAmount(4500), "4.500");
let threw = false;
try { baisaToAmount(1.5); } catch { threw = true; }
expectEqual("baisaToAmount refuses a fraction", threw, true);

// ----- price settings: parse, defaults, owner vs agency -----
expectEqual("price default owner", PRICE_DEFAULTS[PRICE_KEYS.featuredOwner], "3.000");
expectEqual("price default agency", PRICE_DEFAULTS[PRICE_KEYS.featuredAgency], "6.000");
expectEqual("days default", PRICE_DEFAULTS[PRICE_KEYS.featuredDays], "30");
expectEqual("parse 4.5", parsePriceAmount("4.5"), "4.500");
expectEqual("parse Arabic digits", parsePriceAmount("٤٫٥"), "4.500");
expectEqual("rejects abc", parsePriceAmount("abc"), null);
expectEqual("rejects 0", parsePriceAmount("0"), null);
expectEqual("rejects 0.000", parsePriceAmount("0.000"), null);
expectEqual("rejects 1.2345", parsePriceAmount("1.2345"), null);
expectEqual("rejects negative", parsePriceAmount("-1"), null);
expectEqual("rejects over 10000", parsePriceAmount("10000.001"), null);
expectEqual("accepts exactly 10000", parsePriceAmount("10000"), "10000.000");
expectEqual("parse days 30", parseDays("30"), 30);
expectEqual("days 0 refused", parseDays("0"), null);
expectEqual("days 366 refused", parseDays("366"), null);
expectEqual("days 1.5 refused", parseDays("1.5"), null);
expectEqual("days 365 ok", parseDays("365"), 365);
expectEqual("missing row -> default amount", amountOrDefault(null, PRICE_KEYS.featuredOwner), "3.000");
expectEqual("garbage row -> default amount", amountOrDefault("free!", PRICE_KEYS.featuredOwner), "3.000");
expectEqual("stored row wins", amountOrDefault("4.500", PRICE_KEYS.featuredOwner), "4.500");
expectEqual("garbage days -> 30", daysOrDefault("abc"), 30);
const owner = featuredPriceFor(null, {});
expectEqual("owner price with no settings", [owner.amount, owner.baisa, owner.days, owner.audience], ["3.000", 3000, 30, "owner"]);
const agency = featuredPriceFor("agency1", {});
expectEqual("agency price with no settings", [agency.amount, agency.baisa, agency.days, agency.audience], ["6.000", 6000, 30, "agency"]);
const edited = featuredPriceFor(null, { [PRICE_KEYS.featuredOwner]: "4.500", [PRICE_KEYS.featuredDays]: "45" });
expectEqual("edited owner price + days", [edited.amount, edited.baisa, edited.days], ["4.500", 4500, 45]);
expectEqual("edited owner price does not touch the agency price", featuredPriceFor("a", { [PRICE_KEYS.featuredOwner]: "4.500" }).amount, "6.000");

// ----- the gateway's address and answer -----
expectEqual("env: anything but production is the sandbox", [parseThawaniEnv(undefined), parseThawaniEnv("prod"), parseThawaniEnv(" Production ")], ["sandbox", "sandbox", "production"]);
expectEqual("pay page address (sandbox)", payPageUrl("sandbox", "cs_1", "pk key"), "https://uatcheckout.thawani.om/pay/cs_1?key=pk%20key");
expectEqual("pay page address (production)", payPageUrl("production", "cs_1", "pk"), "https://checkout.thawani.om/pay/cs_1?key=pk");

const answer = parseSessionAnswer({
  success: true,
  data: {
    session_id: "cs_1",
    client_reference_id: "pay_1",
    payment_status: "paid",
    total_amount: 3000,
    currency: "omr",
    customer_email: "someone@example.com",
    card: { last4: "4242" },
    metadata: { paymentId: "pay_1" },
  },
});
expectEqual("answer: status / amount / reference / currency", [answer?.status, answer?.amountBaisa, answer?.reference, answer?.currency], ["paid", 3000, "pay_1", "OMR"]);
expectEqual("answer: personal and card fields are not stored", JSON.stringify(answer?.payload).includes("someone@example.com") || JSON.stringify(answer?.payload).includes("4242"), false);
expectEqual("answer: other fields are kept", (answer?.payload as { session_id?: string }).session_id, "cs_1");
expectEqual("answer: missing amount reads as null", parseSessionAnswer({ data: { payment_status: "paid" } })?.amountBaisa, null);
expectEqual("answer: fractional amount reads as null", parseSessionAnswer({ data: { payment_status: "paid", total_amount: 3.5 } })?.amountBaisa, null);
expectEqual("answer: text baisa is read", parseSessionAnswer({ data: { total_amount: "3000" } })?.amountBaisa, 3000);
expectEqual("answer: rubbish is null", [parseSessionAnswer(null), parseSessionAnswer("x"), parseSessionAnswer({})], [null, null, null]);
expectEqual("answer: status is the exact text (Paid is not paid)", parseSessionAnswer({ data: { payment_status: "Paid" } })?.status, "Paid");

// ----- honesty scan: paid placement never reaches estimates or the AI analyst -----
const root = path.resolve(__dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const guarded = [path.join(root, "db", "valuations.ts"), ...walk(path.join(root, "ai"))].filter((f) => !/\.test\.ts$/.test(f));
const forbidden = /featuredUntil|AdCampaign|\bPayment\b|payments\/|featured\.ts|isFeaturedNow|prisma\.payment/;
const leaks = guarded.filter((f) => forbidden.test(readFileSync(f, "utf8")));
expectEqual(`estimate and AI-analyst code never mention payments (${guarded.length} files scanned)`, leaks, []);
expectEqual("the scan really covers files", guarded.length > 2, true);

// The featuring code never writes the honesty fields.
const writers = ["core.ts"].map((f) => readFileSync(path.join(__dirname, f), "utf8")).join("\n");
const listingWrites = [...writers.matchAll(/listing\.update(?:Many)?\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
expectEqual("listing writes in payments/core.ts touch featuredUntil only", listingWrites.every((w) => /featuredUntil/.test(w) && !/provenance|confidence|status:|price:/.test(w.replace(/where:\s*\{[^}]*\}/, ""))), true);

// ----- both languages carry every new string -----
function keysOf(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}
const en = JSON.parse(readFileSync(path.resolve(root, "..", "..", "messages", "en.json"), "utf8"));
const ar = JSON.parse(readFileSync(path.resolve(root, "..", "..", "messages", "ar.json"), "utf8"));
for (const block of ["featured", "adminPayments", "adminPrices"]) {
  expectEqual(`messages: ${block} exists in both languages with the same keys`, keysOf(ar[block]).sort(), keysOf(en[block]).sort());
  expectEqual(`messages: ${block} has no empty strings`, [...keysOf(en[block]), ...keysOf(ar[block])].length > 0, true);
}
expectEqual("messages: the Featured tag reads the same in both languages", [en.featured.label, ar.featured.label], ["Featured · مميز", "Featured · مميز"]);

if (failures > 0) {
  console.error(`\n${failures} payments test(s) failed`);
  process.exit(1);
}
console.log("\nAll payments (pure) tests passed.");
