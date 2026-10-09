// Ad rules (pure) + the click decision. Run with: npm test
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Uploads go to a throwaway folder, set BEFORE storage.ts is loaded.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "opip-ads-test-"));

import {
  AD_LABEL,
  buildAdView,
  campaignStatus,
  clickRatePercent,
  hasOverlap,
  isBotUserAgent,
  isCampaignLive,
  monthlyTotals,
  omanDay,
  parseAdLink,
  parseCampaignInput,
  parseOmanLocal,
  pickCampaign,
  toOmanLocalInput,
  type AdSlotName,
} from "./rules";
import { resolveClick, type ClickCampaign } from "./click";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const now = new Date("2026-10-10T10:00:00Z");
const H = 3600 * 1000;
const mk = (over: Partial<{ id: string; slot: AdSlotName; neighborhoodId: string | null; startsAt: Date; endsAt: Date; isActive: boolean }> = {}) => ({
  id: "c1",
  slot: "HOME_BAND" as AdSlotName,
  neighborhoodId: null as string | null,
  startsAt: new Date(now.getTime() - H),
  endsAt: new Date(now.getTime() + H),
  isActive: true,
  ...over,
});

async function main() {
  // ----- which campaign shows -----
  expectEqual("no campaign -> nothing", pickCampaign([], "HOME_BAND", null, now), null);
  expectEqual("live campaign shows", pickCampaign([mk()], "HOME_BAND", null, now)?.id, "c1");
  expectEqual("switched off -> nothing", pickCampaign([mk({ isActive: false })], "HOME_BAND", null, now), null);
  expectEqual("not started -> nothing", pickCampaign([mk({ startsAt: new Date(now.getTime() + H), endsAt: new Date(now.getTime() + 2 * H) })], "HOME_BAND", null, now), null);
  expectEqual("expired -> nothing", pickCampaign([mk({ startsAt: new Date(now.getTime() - 2 * H), endsAt: new Date(now.getTime() - H) })], "HOME_BAND", null, now), null);
  expectEqual("start moment is included", isCampaignLive(mk({ startsAt: now }), now), true);
  expectEqual("end moment is excluded", isCampaignLive(mk({ endsAt: now }), now), false);
  expectEqual("wrong slot -> nothing", pickCampaign([mk({ slot: "MARKET_SIDEBAR" })], "HOME_BAND", null, now), null);
  const area = mk({ slot: "PROPERTY_BELOW_FINANCIALS", neighborhoodId: "n1" });
  expectEqual("per-area: own area shows", pickCampaign([area], "PROPERTY_BELOW_FINANCIALS", "n1", now)?.id, "c1");
  expectEqual("per-area: another area never shows it", pickCampaign([area], "PROPERTY_BELOW_FINANCIALS", "n2", now), null);
  expectEqual("per-area: no area given -> nothing", pickCampaign([area], "PROPERTY_BELOW_FINANCIALS", null, now), null);
  const sponsor = mk({ slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: "n1" });
  expectEqual("sponsor: no fallback to another area", pickCampaign([sponsor], "NEIGHBORHOOD_SPONSOR", "n9", now), null);
  expectEqual("status words", [
    campaignStatus(mk({ isActive: false }), now),
    campaignStatus(mk({ startsAt: new Date(now.getTime() + H), endsAt: new Date(now.getTime() + 2 * H) }), now),
    campaignStatus(mk({ startsAt: new Date(now.getTime() - 2 * H), endsAt: new Date(now.getTime() - H) }), now),
    campaignStatus(mk(), now),
  ], ["paused", "scheduled", "ended", "live"]);

  // ----- what the page renders: the label is ALWAYS there -----
  const text = { linkHint: "hint", by: "By X", altFallback: "X — ad" };
  const row = { id: "c1", slot: "HOME_BAND" as AdSlotName, advertiser: "X", altEn: "English alt", altAr: "نص عربي", imageEnPath: "ads/c1/en.png", imageArPath: "ads/c1/ar.png" };
  for (const slot of ["HOME_BAND", "MARKET_SIDEBAR", "PROPERTY_BELOW_FINANCIALS", "NEIGHBORHOOD_SPONSOR"] as AdSlotName[]) {
    for (const locale of ["en", "ar"]) {
      expectEqual(`label present (${slot}, ${locale})`, buildAdView({ ...row, slot }, locale, text).label, "Ad · إعلان");
    }
  }
  expectEqual("label text is the owner's wording", AD_LABEL, "Ad · إعلان");
  expectEqual("Arabic page uses Arabic image + alt", [buildAdView(row, "ar", text).imageSrc, buildAdView(row, "ar", text).alt], ["/api/images/ads/c1/ar.png", "نص عربي"]);
  expectEqual("English page uses English image + alt", [buildAdView(row, "en", text).imageSrc, buildAdView(row, "en", text).alt], ["/api/images/ads/c1/en.png", "English alt"]);
  expectEqual("Arabic page falls back to English", [buildAdView({ ...row, imageArPath: null, altAr: null }, "ar", text).imageSrc, buildAdView({ ...row, imageArPath: null, altAr: null }, "ar", text).alt], ["/api/images/ads/c1/en.png", "English alt"]);
  expectEqual("the link goes through the click route", buildAdView(row, "en", text).href, "/api/ads/c1/click");
  expectEqual("'By' shows on the sponsor strip only", [buildAdView(row, "en", text).by, buildAdView({ ...row, slot: "NEIGHBORHOOD_SPONSOR" }, "en", text).by], [null, "By X"]);

  // ----- link: https only -----
  expectEqual("https accepted", parseAdLink("https://example.com/offer?a=1")?.startsWith("https://example.com/"), true);
  for (const bad of ["http://example.com", "javascript:alert(1)", "data:text/html,hi", "https://user:pw@example.com", "//example.com", "example.com", "", "ftp://example.com", "https://" + "a".repeat(600) + ".com", "https://localhost"]) {
    expectEqual(`link refused: ${bad.slice(0, 30)}`, parseAdLink(bad), null);
  }

  // ----- overlap -----
  const a = { id: "a", slot: "HOME_BAND" as AdSlotName, neighborhoodId: null as string | null, startsAt: new Date("2026-10-01T00:00:00Z"), endsAt: new Date("2026-11-01T00:00:00Z"), isActive: true };
  expectEqual("overlapping dates, same slot refused", hasOverlap({ slot: "HOME_BAND", neighborhoodId: null, startsAt: new Date("2026-10-20T00:00:00Z"), endsAt: new Date("2026-11-20T00:00:00Z") }, [a]), true);
  expectEqual("back-to-back is fine", hasOverlap({ slot: "HOME_BAND", neighborhoodId: null, startsAt: a.endsAt, endsAt: new Date("2026-12-01T00:00:00Z") }, [a]), false);
  expectEqual("different slot is fine", hasOverlap({ slot: "MARKET_SIDEBAR", neighborhoodId: null, startsAt: a.startsAt, endsAt: a.endsAt }, [a]), false);
  expectEqual("same slot, other area is fine", hasOverlap({ slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: "n2", startsAt: a.startsAt, endsAt: a.endsAt }, [{ ...a, slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: "n1" }]), false);
  expectEqual("same slot, same area refused", hasOverlap({ slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: "n1", startsAt: a.startsAt, endsAt: a.endsAt }, [{ ...a, slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: "n1" }]), true);
  expectEqual("a paused campaign does not block", hasOverlap({ slot: "HOME_BAND", neighborhoodId: null, startsAt: a.startsAt, endsAt: a.endsAt }, [{ ...a, isActive: false }]), false);
  expectEqual("editing itself is not a clash", hasOverlap({ id: "a", slot: "HOME_BAND", neighborhoodId: null, startsAt: a.startsAt, endsAt: a.endsAt }, [a]), false);

  // ----- form -----
  const good = { advertiser: "Bank Muscat", slot: "HOME_BAND", neighborhoodId: "", linkUrl: "https://example.com", altEn: "Alt", altAr: "", startsAt: "2026-10-12T09:00", endsAt: "2026-11-12T09:00", agreedPrice: "60.000" };
  expectEqual("good form accepted", parseCampaignInput(good).ok, true);
  expectEqual("end before start refused", parseCampaignInput({ ...good, endsAt: "2026-10-01T09:00" }), { ok: false, error: "dates" });
  expectEqual("equal start/end refused", parseCampaignInput({ ...good, endsAt: good.startsAt }), { ok: false, error: "dates" });
  expectEqual("per-area slot needs an area", parseCampaignInput({ ...good, slot: "NEIGHBORHOOD_SPONSOR" }), { ok: false, error: "neighborhood" });
  expectEqual("general slot drops a stray area", (parseCampaignInput({ ...good, neighborhoodId: "n1" }) as { value: { neighborhoodId: string | null } }).value.neighborhoodId, null);
  expectEqual("http link refused", parseCampaignInput({ ...good, linkUrl: "http://example.com" }), { ok: false, error: "link" });
  expectEqual("missing alt refused", parseCampaignInput({ ...good, altEn: " " }), { ok: false, error: "required" });
  expectEqual("unknown slot refused", parseCampaignInput({ ...good, slot: "EVERYWHERE" }), { ok: false, error: "required" });
  expectEqual("price with 4 decimals refused", parseCampaignInput({ ...good, agreedPrice: "1.2345" }), { ok: false, error: "price" });
  expectEqual("Arabic-digit price accepted", (parseCampaignInput({ ...good, agreedPrice: "٦٠.٠٠٠" }) as { value: { agreedPrice: string } }).value.agreedPrice, "60.000");
  expectEqual("31 February refused", parseOmanLocal("2026-02-31T10:00"), null);

  // ----- Oman day / time -----
  expectEqual("22:00 UTC is already tomorrow in Oman", omanDay(new Date("2026-10-10T22:00:00Z")).toISOString(), "2026-10-11T00:00:00.000Z");
  expectEqual("19:59 UTC is still today in Oman", omanDay(new Date("2026-10-10T19:59:00Z")).toISOString(), "2026-10-10T00:00:00.000Z");
  expectEqual("09:00 Oman = 05:00 UTC", parseOmanLocal("2026-10-12T09:00")?.toISOString(), "2026-10-12T05:00:00.000Z");
  expectEqual("input round trip", toOmanLocalInput(parseOmanLocal("2026-10-12T09:00")!), "2026-10-12T09:00");

  // ----- counting helpers -----
  for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "Slackbot-LinkExpanding", "Mozilla/5.0 (compatible; bingbot)", "SomeCrawler", "", null, undefined]) {
    expectEqual(`not counted: ${String(ua)}`, isBotUserAgent(ua), true);
  }
  expectEqual("a phone browser is counted", isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"), false);
  expectEqual("click rate", [clickRatePercent(0, 0), clickRatePercent(200, 5)], [null, "2.5%"]);
  expectEqual("monthly totals", monthlyTotals([
    { day: new Date("2026-10-31T00:00:00Z"), views: 5, clicks: 1 },
    { day: new Date("2026-11-01T00:00:00Z"), views: 2, clicks: 0 },
    { day: new Date("2026-10-02T00:00:00Z"), views: 3, clicks: 1 },
  ]), [{ month: "2026-10", views: 8, clicks: 2 }, { month: "2026-11", views: 2, clicks: 0 }]);

  // ----- click route decision -----
  const stored: ClickCampaign = { linkUrl: "https://advertiser.example.com/landing", isActive: true, startsAt: new Date(now.getTime() - H), endsAt: new Date(now.getTime() + H) };
  let counts = 0;
  const deps = (c: ClickCampaign | null, allow = true) => ({
    find: async () => c,
    allowCount: () => allow,
    count: async () => { counts++; },
    now,
  });
  let r = await resolveClick("abc", deps(stored));
  expectEqual("click redirects to the STORED link only", r, { status: 302, location: "https://advertiser.example.com/landing", counted: true });
  expectEqual("one click counted", counts, 1);
  r = await resolveClick("https://evil.example/?url=https://evil.example", deps(stored));
  expectEqual("an id that is really a URL is a 404", r, { status: 404 });
  expectEqual("unknown id -> 404", await resolveClick("nope", deps(null)), { status: 404 });
  counts = 0;
  r = await resolveClick("abc", deps({ ...stored, isActive: false }));
  expectEqual("paused campaign still redirects, not counted", [r.status, counts], [302, 0]);
  r = await resolveClick("abc", deps({ ...stored, endsAt: new Date(now.getTime() - 1) }));
  expectEqual("ended campaign still redirects, not counted", [r.status, counts], [302, 0]);
  r = await resolveClick("abc", deps(stored, false));
  expectEqual("over the limit still redirects, not counted", [r.status, counts], [302, 0]);
  r = await resolveClick("abc", deps({ ...stored, linkUrl: "http://advertiser.example.com" }));
  expectEqual("a non-https stored link is never followed", r, { status: 404 });
  r = await resolveClick("abc", { ...deps(stored), count: async () => { throw new Error("db down"); } });
  expectEqual("a counting failure never blocks the redirect", r.status, 302);

  // ----- the click route sets no cookie and only sends the stored address -----
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(path.join(process.cwd(), "src/app/api/ads/[id]/click/route.ts"), "utf8");
  expectEqual("click route never sets a cookie", /set-cookie|cookies\(\)/i.test(route), false);
  expectEqual("click route never reads the address bar", /searchParams|new URL\(req/.test(route), false);

  // ----- uploads -----
  const { saveAdImage, dataDir } = await import("@/lib/storage");
  const png = (n = 16) => {
    const bytes = new Uint8Array(8 + Math.ceil(n));
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return new File([bytes], "a.png");
  };
  const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "a.jpg");
  const webp = new File([Buffer.from("RIFF\0\0\0\0WEBPxxxx", "binary")], "a.webp");
  for (const [name, f, ext] of [["png", png(), ".png"], ["jpeg", jpg, ".jpg"], ["webp", webp, ".webp"]] as const) {
    const saved = await saveAdImage("camp1", f);
    expectEqual(`real ${name} accepted, kept under ads/camp1/`, "path" in saved && saved.path.startsWith("ads/camp1/") && saved.path.endsWith(ext), true);
    expectEqual(`${name} written inside the data folder`, "path" in saved && existsSync(path.join(dataDir(), saved.path)), true);
  }
  expectEqual("renamed text file refused by its bytes", await saveAdImage("camp1", new File(["<script>alert(1)</script>"], "x.jpg", { type: "image/jpeg" })), { error: "type" });
  expectEqual("SVG refused", await saveAdImage("camp1", new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "x.svg", { type: "image/svg+xml" })), { error: "type" });
  expectEqual("GIF refused", await saveAdImage("camp1", new File([Buffer.from("GIF89a....")], "x.gif", { type: "image/gif" })), { error: "type" });
  expectEqual("2.1 MB refused", await saveAdImage("camp1", png(2.1 * 1024 * 1024)), { error: "size" });
  expectEqual("2 MB exactly accepted", "path" in (await saveAdImage("camp1", png(2 * 1024 * 1024 - 8))), true);

  if (failures > 0) {
    console.error(`\n${failures} ad test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAd rule tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
