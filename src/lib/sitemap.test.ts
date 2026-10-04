// Sitemap builder tests. Run with: npm test
import { buildSitemapEntries, STATIC_PATHS, type SitemapProperty } from "./sitemap";
import { ROBOTS_ALLOW, ROBOTS_DISALLOW, buildRobots } from "./robotsRules";
import { resolveSiteUrl } from "./siteUrl";

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL ${label}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const BASE = "https://example.om";
const d = new Date("2026-09-01T00:00:00Z");
const later = new Date("2026-09-20T00:00:00Z");

function prop(id: string, statuses: string[], opts: { sample?: boolean; listingSample?: boolean } = {}): SitemapProperty {
  return {
    id,
    isSample: opts.sample ?? false,
    updatedAt: d,
    listings: statuses.map((status) => ({
      status,
      isSample: opts.listingSample ?? false,
      updatedAt: later,
    })),
  };
}

const urls = (input: Parameters<typeof buildSitemapEntries>[0], base = BASE, max?: number) =>
  buildSitemapEntries(input, base, max).map((e) => e.url);

// 1. Both languages for every static path; en/ar/x-default pair on every entry.
{
  const entries = buildSitemapEntries({ neighborhoodSlugs: ["al-khuwair"], properties: [prop("p1", ["ACTIVE"])] }, BASE);
  const u = entries.map((e) => e.url);
  check("static: every path in /en and /ar", STATIC_PATHS.every((p) => {
    const tail = p === "/" ? "" : p;
    return u.includes(`${BASE}/en${tail}`) && u.includes(`${BASE}/ar${tail}`);
  }));
  check("neighbourhood in both languages", u.includes(`${BASE}/en/market/al-khuwair`) && u.includes(`${BASE}/ar/market/al-khuwair`));
  check("alternates: en, ar, x-default on every entry", entries.every((e) => {
    const l = e.alternates.languages;
    return Boolean(l.en && l.ar && l["x-default"]) && l["x-default"] === l.en && (e.url === l.en || e.url === l.ar);
  }));
  check("home x-default is /en, not a different page", entries.find((e) => e.url === `${BASE}/ar`)?.alternates.languages["x-default"] === `${BASE}/en`);
}

// 2. Only live listings.
for (const status of ["PENDING_REVIEW", "DRAFT", "REJECTED", "ARCHIVED", "SOLD", "RENTED"]) {
  check(`${status}-only property is left out`, !urls({ neighborhoodSlugs: [], properties: [prop("x", [status])] }).some((u) => u.includes("/properties/x")));
}
check("ACTIVE property is in, both languages", (() => {
  const u = urls({ neighborhoodSlugs: [], properties: [prop("live", ["ACTIVE"])] });
  return u.includes(`${BASE}/en/properties/live`) && u.includes(`${BASE}/ar/properties/live`);
})());
check("property with no listings at all is left out", !urls({ neighborhoodSlugs: [], properties: [prop("bare", [])] }).some((u) => u.includes("/properties/bare")));
check("ACTIVE + pending mix is in", urls({ neighborhoodSlugs: [], properties: [prop("mix", ["PENDING_REVIEW", "ACTIVE"])] }).some((u) => u.includes("/properties/mix")));

// 3. Sample records.
check("sample property left out", !urls({ neighborhoodSlugs: [], properties: [prop("s1", ["ACTIVE"], { sample: true })] }).some((u) => u.includes("/properties/s1")));
check("property whose only live listing is sample left out", !urls({ neighborhoodSlugs: [], properties: [prop("s2", ["ACTIVE"], { listingSample: true })] }).some((u) => u.includes("/properties/s2")));

// last modified = newest of property/listing; static pages carry no date
{
  const e = buildSitemapEntries({ neighborhoodSlugs: [], properties: [prop("t", ["ACTIVE"])] }, BASE);
  check("property lastModified is the newest date", e.find((x) => x.url.endsWith("/en/properties/t"))?.lastModified?.getTime() === later.getTime());
  check("static pages carry no invented date", e.find((x) => x.url === `${BASE}/en/market`)?.lastModified === undefined);
}

// 4. Private and non-page areas never appear.
{
  const u = urls({ neighborhoodSlugs: ["a"], properties: [prop("p", ["ACTIVE"])] });
  const banned = ["/admin", "/agency", "/account", "/login", "/register", "/favorites", "/compare", "/api"];
  check("no private, compare or api address", !u.some((x) => banned.some((b) => x.includes(b))));
}

// 5. Base handling.
{
  const a = urls({ neighborhoodSlugs: [], properties: [] }, BASE);
  const b = urls({ neighborhoodSlugs: [], properties: [] }, `${BASE}/`);
  check("trailing slash on the base does not double up", JSON.stringify(a) === JSON.stringify(b) && !b.some((x) => x.includes("//en") || x.includes(".om//")));
  check("every address starts with the base", a.every((x) => x.startsWith(`${BASE}/`)));
}

// 6. Cap.
{
  const many = Array.from({ length: 10 }, (_, i) => prop(`c${i}`, ["ACTIVE"]));
  const u = urls({ neighborhoodSlugs: [], properties: many }, BASE, 3).filter((x) => x.includes("/properties/"));
  check("cap: more properties in than the limit gives exactly the limit out (x2 languages)", u.length === 6);
}

// Base-address helper.
check("siteUrl: trailing slash dropped", resolveSiteUrl("https://example.om/", "production") === "https://example.om");
check("siteUrl: path dropped", resolveSiteUrl("https://example.om/some/where", "production") === "https://example.om");
check("siteUrl: unset in production -> null", resolveSiteUrl(undefined, "production") === null);
check("siteUrl: invalid in production -> null", resolveSiteUrl("not a url", "production") === null);
check("siteUrl: non-http scheme in production -> null", resolveSiteUrl("ftp://x.om", "production") === null);
check("siteUrl: unset outside production -> localhost", resolveSiteUrl(undefined, "development") === "http://localhost:3000");
check("siteUrl: local value kept", resolveSiteUrl("http://localhost:3000", "development") === "http://localhost:3000");

// Robots rules.
for (const area of ["admin", "agency", "account", "login", "register", "favorites"]) {
  check(`robots blocks /en/${area} and /ar/${area}`, ROBOTS_DISALLOW.includes(`/en/${area}`) && ROBOTS_DISALLOW.includes(`/ar/${area}`));
}
check("robots blocks /api/ but allows /api/images/", ROBOTS_DISALLOW.includes("/api/") && ROBOTS_ALLOW.includes("/api/images/"));
check("robots does not block public pages", !ROBOTS_DISALLOW.some((p) => ["/en", "/ar", "/en/market", "/en/properties"].includes(p)));
check("robots sitemap line = base + /sitemap.xml", buildRobots(`${BASE}/`).sitemap === `${BASE}/sitemap.xml`);
check("robots omits the sitemap line when the base is unknown", !("sitemap" in buildRobots(null)));

if (failures > 0) {
  console.error(`\n${failures} sitemap test(s) failed`);
  process.exit(1);
}
console.log("\nAll sitemap tests passed.");
