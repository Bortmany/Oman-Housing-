// The saved-search alert run against a real (test) database, plus the job
// route's guard. Run with: npm test (scripts/with-test-db.mjs points
// DATABASE_URL at the *_test database). Refuses to run anywhere else and
// cleans up every row it makes.
//
// Proves: instant vs daily; a second run sends nothing new; two runs at once
// send once; a failed send is restored and retried; per-user and per-run caps;
// sample / non-ACTIVE listings never alert; "not configured" moves nothing;
// Arabic accounts get RTL Arabic mail; 90-day log cleanup; the route says 503
// (no secret), 401 (wrong secret), 405 (GET).
import Module from "node:module";
import { prisma } from "../prisma";
import { runSavedSearchAlerts } from "./runner";
import type { EmailMessage, SendResult } from "../email/send";

const dbName = new URL(process.env.DATABASE_URL ?? "postgresql://x/none").pathname;
if (!dbName.endsWith("_test")) {
  console.error(`Refusing to run: DATABASE_URL (${dbName}) is not a test database. Use npm test.`);
  process.exit(1);
}

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const TAG = `alr-${Date.now()}`;
const HOUR = 3600_000;
const T0 = new Date(Math.floor(Date.now() / 1000) * 1000);
const at = (ms: number) => new Date(T0.getTime() + ms);
const baseUrl = "https://example.test";

const sent: EmailMessage[] = [];
const okSend = async (m: EmailMessage): Promise<SendResult> => {
  sent.push(m);
  return { status: "sent", id: "x" };
};
const run = (now: Date, extra: Partial<Parameters<typeof runSavedSearchAlerts>[0]> = {}) =>
  runSavedSearchAlerts({ mode: "live", send: okSend, now, baseUrl, ...extra });

async function main() {
  const gov = await prisma.governorate.create({ data: { slug: `${TAG}-g`, nameEn: "G", nameAr: "G" } });
  const city = await prisma.city.create({ data: { slug: `${TAG}-c`, nameEn: "C", nameAr: "C", governorateId: gov.id } });
  const admin = await prisma.user.create({ data: { email: `admin-${TAG}@example.test`, role: "ADMIN" } });
  const users: string[] = [admin.id];
  const hoods: string[] = [];

  const newUser = async (key: string, locale: "en" | "ar", name: string | null = "Sara") => {
    const u = await prisma.user.create({ data: { email: `${key}-${TAG}@example.test`, locale, name } });
    users.push(u.id);
    return u;
  };
  const newHood = async (key: string) => {
    const h = await prisma.neighborhood.create({
      data: { slug: `${TAG}-${key}`, nameEn: `Hood ${key}`, nameAr: `حي ${key}`, cityId: city.id },
    });
    hoods.push(h.id);
    return h;
  };
  const newListing = async (
    hoodId: string,
    o: { published: Date; title?: string; type?: "VILLA" | "APARTMENT"; sample?: boolean; status?: "ACTIVE" | "DRAFT" },
  ) => {
    const property = await prisma.property.create({
      data: {
        neighborhoodId: hoodId, type: o.type ?? "VILLA", titleEn: o.title ?? `${TAG} home`,
        titleAr: "منزل", bedrooms: 3, isSample: o.sample ?? false,
      },
    });
    return prisma.listing.create({
      data: {
        propertyId: property.id, listingType: "SALE", price: 250000, status: o.status ?? "ACTIVE",
        createdById: admin.id, isSample: o.sample ?? false, publishedAt: o.published,
      },
    });
  };
  const newSearch = (userId: string, hoodSlug: string, name: string, frequency = "instant", extraQuery = "") =>
    prisma.savedSearch.create({
      data: { userId, name, query: `hood=${hoodSlug}${extraQuery}`, frequency, createdAt: at(-2 * HOUR) },
    });
  // Searches are scanned globally, so each scenario starts from a clean slate.
  const resetSearches = async () => {
    await prisma.savedSearch.deleteMany({ where: { userId: { in: users } } });
    await prisma.alertLog.deleteMany({ where: { userId: { in: users } } });
    sent.length = 0;
  };
  const get = (id: string) => prisma.savedSearch.findUniqueOrThrow({ where: { id } });
  const logsFor = (savedSearchId: string) =>
    prisma.alertLog.findMany({ where: { savedSearchId }, orderBy: { createdAt: "asc" } });

  try {
    // ---------------- 1. instant vs daily, idempotency, locale ----------------
    {
      const hood = await newHood("a");
      const ua = await newUser("ar", "ar");
      const ub = await newUser("en", "en", null);
      await newListing(hood.id, { published: at(-HOUR), title: "Real villa" });
      // Never alert: a sample home (different type, so it is not "superseded"),
      // and a listing that is not live.
      await newListing(hood.id, { published: at(-HOUR), title: "SAMPLE-HOME", type: "APARTMENT", sample: true });
      await newListing(hood.id, { published: at(-HOUR), title: "DRAFT-HOME", status: "DRAFT" });
      const s1 = await newSearch(ua.id, hood.slug, "Instant AR", "instant");
      const s2 = await newSearch(ua.id, hood.slug, "Daily AR", "daily");
      const s3 = await newSearch(ub.id, hood.slug, "Daily EN", "daily");

      const r1 = await run(T0);
      expectEqual("run 1 sends one per search", [r1.status, r1.due, r1.sent, r1.failed], ["ok", 3, 3, 0]);
      const arMail = sent.find((m) => m.subject.includes("Instant AR"))!;
      const enMail = sent.find((m) => m.subject.includes("Daily EN"))!;
      expectEqual("arabic account gets arabic subject", arMail.subject, "إعلانات جديدة لبحثك «Instant AR»");
      expectEqual("arabic html is rtl", /<html lang="ar" dir="rtl">/.test(arMail.html ?? ""), true);
      expectEqual("english account gets english, ltr", [enMail.subject, /dir="ltr"/.test(enMail.html ?? "")], ["New listings for “Daily EN”", true]);
      expectEqual("plain text part always present", sent.every((m) => m.text.length > 20), true);
      expectEqual("real listing included, sample and draft never",
        sent.every((m) => /Real villa|منزل/.test(m.text) && !m.text.includes("SAMPLE-HOME") && !m.text.includes("DRAFT-HOME") && !(m.html ?? "").includes("SAMPLE-HOME")), true);
      expectEqual("each price carries its source label", sent.every((m) => /User submitted|المصدر/.test(m.text)), true);
      expectEqual("claim moved lastAlertedAt", (await get(s1.id)).lastAlertedAt?.getTime(), T0.getTime());
      expectEqual("log says sent", (await logsFor(s1.id)).map((l) => l.status), ["sent"]);

      const again = await run(T0);
      expectEqual("second run sends nothing new", [again.sent, again.due, sent.length], [0, 0, 3]);

      // New listing 30 min later; run an hour after the first run.
      await newListing(hood.id, { published: at(0.5 * HOUR), title: "Second villa" });
      const r3 = await run(at(HOUR));
      expectEqual("instant sends again, daily waits (within 24h)", [r3.sent, r3.due], [1, 1]);
      expectEqual("only the instant search was mailed", sent.at(-1)!.subject.includes("Instant AR"), true);
      expectEqual("daily search untouched", (await get(s2.id)).lastAlertedAt?.getTime(), T0.getTime());

      // A day later, with something new, the daily searches go out too.
      await newListing(hood.id, { published: at(24 * HOUR), title: "Third villa" });
      const before = sent.length;
      const r4 = await run(at(25 * HOUR));
      expectEqual("a day later daily searches send", [r4.sent, sent.length - before], [3, 3]);
      expectEqual("daily mail counts everything since its last alert",
        sent.find((m, i) => i >= before && m.subject.includes("Daily EN"))!.text.includes("New since your last alert: 2"), true);
      expectEqual("lastMatchedListingId is kept", typeof (await get(s3.id)).lastMatchedListingId, "string");
      await resetSearches();
    }

    // ---------------- 2. failure is restored and retried ----------------
    {
      const hood = await newHood("b");
      const u = await newUser("fail", "en");
      await newListing(hood.id, { published: at(-HOUR) });
      const s = await newSearch(u.id, hood.slug, "Retry me");
      const failing = await run(T0, { send: async () => ({ status: "failed", reason: "http_500" }) });
      expectEqual("failed send counted", [failing.sent, failing.failed], [0, 1]);
      expectEqual("lastAlertedAt put back", (await get(s.id)).lastAlertedAt, null);
      expectEqual("log says failed with a short reason", (await logsFor(s.id)).map((l) => [l.status, l.reason]), [["failed", "http_500"]]);
      const retry = await run(at(HOUR));
      expectEqual("next run retries once and succeeds", [retry.sent, sent.length], [1, 1]);
      expectEqual("a failed try is logged, then the retry is sent", (await logsFor(s.id)).map((l) => l.status), ["failed", "sent"]);

      // One search throwing never stops the others.
      await resetSearches();
      const good = await newSearch(u.id, hood.slug, "Good one");
      const bad = await newSearch(u.id, hood.slug, "Bad one");
      const picky = await run(at(2 * HOUR), {
        send: async (m) => {
          if (m.subject.includes("Bad one")) throw new Error("boom");
          return okSend(m);
        },
      });
      expectEqual("one search failing does not stop the rest", [picky.sent, picky.failed], [1, 1]);
      void good; void bad;
      await resetSearches();
    }

    // ---------------- 2b. permanent failures stop; failed sends count; unsubscribe ----------------
    {
      const hood = await newHood("f");
      const u = await newUser("perm", "en");
      await newListing(hood.id, { published: at(-HOUR) });
      const s = await newSearch(u.id, hood.slug, "Never works");
      let attempts = 0;
      const alwaysFail = async (): Promise<SendResult> => {
        attempts++;
        return { status: "failed", reason: "http_422" };
      };
      for (const h of [0, 1, 2]) await run(at(h * HOUR), { send: alwaysFail });
      expectEqual("three failed tries so far", attempts, 3);
      const fourth = await run(at(3 * HOUR), { send: alwaysFail });
      expectEqual("after 3 failures in 24 h it stops trying", [attempts, fourth.failed, fourth.deferred], [3, 0, 1]);
      const later = await run(at(25 * HOUR), { send: alwaysFail });
      expectEqual("a day on it may try again", [attempts, later.failed], [4, 1]);
      expectEqual("failures are logged", (await logsFor(s.id)).filter((l) => l.status === "failed").length, 4);
      await resetSearches();

      // Failed sends use up the per-user daily cap.
      const u2 = await newUser("failcap", "en");
      await newSearch(u2.id, hood.slug, "Cap by failure");
      let tries = 0;
      const failing = async (): Promise<SendResult> => {
        tries++;
        return { status: "failed", reason: "network" };
      };
      await run(at(4 * HOUR), { send: failing, maxPerUser: 1 });
      const capped = await run(at(5 * HOUR), { send: failing, maxPerUser: 1 });
      expectEqual("a failed try counts toward the daily cap", [tries, capped.deferred], [1, 1]);
      await resetSearches();

      // Unsubscribed (frequency "off") searches are skipped; mail carries the link + headers.
      const u3 = await newUser("unsub", "en");
      const off = await newSearch(u3.id, hood.slug, "Switched off", "off");
      const on = await newSearch(u3.id, hood.slug, "Still on", "instant", "&minPrice=1");
      const seen: EmailMessage[] = [];
      const r = await run(at(6 * HOUR), { send: async (m) => (seen.push(m), { status: "sent", id: "x" }) });
      expectEqual("only the search that is still on is mailed", [r.sent, seen.length, seen[0]?.subject.includes("Still on")], [1, 1, true]);
      expectEqual("unsubscribed search untouched", (await get(off.id)).lastAlertedAt, null);
      expectEqual("mail has one-click headers and a signed link",
        [seen[0].headers?.["List-Unsubscribe-Post"], (seen[0].headers?.["List-Unsubscribe"] ?? "").includes(`s=${on.id}`), seen[0].text.includes("/api/alerts/unsubscribe?s=" + on.id)],
        ["List-Unsubscribe=One-Click", true, true]);
      await resetSearches();
    }

    // ---------------- 3. two runs at once send once ----------------
    {
      const hood = await newHood("c");
      const u = await newUser("race", "en");
      await newListing(hood.id, { published: at(-HOUR) });
      const s = await newSearch(u.id, hood.slug, "Race");
      const [x, y] = await Promise.all([run(T0), run(T0)]);
      expectEqual("simultaneous runs: exactly one email", [x.sent + y.sent, sent.length], [1, 1]);
      expectEqual("one claim row", (await logsFor(s.id)).length, 1);
      await resetSearches();
    }

    // ---------------- 4. caps ----------------
    {
      const hood = await newHood("d");
      const u = await newUser("cap", "en");
      await newListing(hood.id, { published: at(-HOUR) });
      for (let i = 0; i < 12; i++) await newSearch(u.id, hood.slug, `Cap ${i}`, "instant", `&minPrice=${i}`);
      const r = await run(T0);
      expectEqual("12 matching searches: 10 emails, 2 held back", [r.sent, r.deferred], [10, 2]);
      await newListing(hood.id, { published: at(0.5 * HOUR) });
      const r2 = await run(at(HOUR));
      expectEqual("still capped later the same day", [r2.sent, r2.deferred], [0, 12]);
      await resetSearches();

      const u2 = await newUser("runcap", "en");
      for (let i = 0; i < 4; i++) await newSearch(u2.id, hood.slug, `Run ${i}`, "instant", `&minPrice=${i}`);
      const r3 = await run(at(2 * HOUR), { maxPerRun: 3 });
      expectEqual("per-run cap: 3 sent, 1 waits for next run", [r3.sent, r3.deferred], [3, 1]);
      const r4 = await run(at(3 * HOUR), { maxPerRun: 3 });
      expectEqual("the waiting one goes out next run (nothing new for the others)", r4.sent, 1);
      await resetSearches();
    }

    // ---------------- 5. email not connected ----------------
    {
      const hood = await newHood("e");
      const u = await newUser("off", "en");
      await newListing(hood.id, { published: at(-HOUR) });
      const s = await newSearch(u.id, hood.slug, "Waiting");
      const off = await run(T0, { mode: "off", send: async () => ({ status: "not-configured" }) });
      expectEqual("off: reports not-configured, sends nothing", [off.status, off.sent, sent.length], ["not-configured", 0, 0]);
      expectEqual("off: nothing advanced", (await get(s.id)).lastAlertedAt, null);
      await run(at(HOUR), { mode: "off" });
      expectEqual("off: one note per search per day", (await logsFor(s.id)).map((l) => l.status), ["not-configured"]);
      const live = await run(at(2 * HOUR));
      expectEqual("when email arrives, the waiting alert goes out", [live.sent, sent.length], [1, 1]);
      await resetSearches();
    }

    // ---------------- 6. 90-day log cleanup ----------------
    {
      const u = await newUser("old", "en");
      await prisma.alertLog.create({
        data: { userId: u.id, savedSearchId: "gone", frequency: "daily", matchedCount: 1, status: "sent", createdAt: at(-100 * 24 * HOUR) },
      });
      await prisma.alertLog.create({
        data: { userId: u.id, savedSearchId: "recent", frequency: "daily", matchedCount: 1, status: "sent", createdAt: at(-10 * 24 * HOUR) },
      });
      await run(T0);
      expectEqual("logs older than 90 days are deleted, newer kept",
        (await prisma.alertLog.findMany({ where: { userId: u.id } })).map((l) => l.savedSearchId), ["recent"]);
      await resetSearches();
    }

    // ---------------- 7. the job route's guard ----------------
    {
      // The route pulls in "server-only" modules, which refuse to load outside
      // Next's bundler; let them load here so the real route can be called.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = Module as any;
      const origLoad = mod._load;
      mod._load = (request: string, ...rest: unknown[]) =>
        request === "server-only" ? {} : origLoad(request, ...rest);
      const { POST, GET } = await import("../../app/api/jobs/saved-search-alerts/route");
      const call = (header?: string) =>
        POST(new Request("http://localhost/api/jobs/saved-search-alerts", {
          method: "POST", headers: header ? { authorization: header } : {},
        }));
      const saved = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      expectEqual("no CRON_SECRET: 503", (await call("Bearer anything-at-all-123")).status, 503);
      process.env.CRON_SECRET = "a-long-enough-secret-value-1";
      expectEqual("wrong secret: 401", (await call("Bearer not-the-secret-not-the-secret")).status, 401);
      expectEqual("no header: 401", (await call()).status, 401);
      expectEqual("GET: 405", (await GET()).status, 405);
      const savedKeys = [process.env.RESEND_API_KEY, process.env.EMAIL_FROM, process.env.EMAIL_DEV_LOG];
      delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.EMAIL_DEV_LOG;
      const okRes = await call("Bearer a-long-enough-secret-value-1");
      expectEqual("right secret, no email keys: 200 not-configured",
        [okRes.status, await okRes.json()], [200, { ok: true, status: "not-configured" }]);
      [process.env.RESEND_API_KEY, process.env.EMAIL_FROM, process.env.EMAIL_DEV_LOG] = savedKeys as string[];
      if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
    }

    // ---------------- 8. the public unsubscribe link ----------------
    {
      const hood = await newHood("g");
      const u = await newUser("link", "ar");
      const mine = await newSearch(u.id, hood.slug, "Mine", "instant");
      const other = await newSearch(u.id, hood.slug, "Other", "daily", "&minPrice=1");
      const { GET: unsubGet, POST: unsubPost } = await import("../../app/api/alerts/unsubscribe/route");
      const { buildUnsubscribeUrl } = await import("./unsubscribe");
      const link = buildUnsubscribeUrl("https://example.test", mine.id, "ar");
      const freq = async (id: string) => (await get(id)).frequency;

      const bad = await unsubGet(new Request(link.replace(/t=[0-9a-f]{4}/, "t=0000")));
      expectEqual("a tampered link is refused and changes nothing", [bad.status, await freq(mine.id)], [400, "instant"]);
      const wrongId = await unsubGet(new Request(link.replace(`s=${mine.id}`, `s=${other.id}`)));
      expectEqual("a link for another search is refused", [wrongId.status, await freq(other.id)], [400, "daily"]);

      const good = await unsubGet(new Request(link));
      const html = await good.text();
      expectEqual("valid link turns that search off, Arabic page", [good.status, await freq(mine.id), /dir="rtl"/.test(html)], [200, "off", true]);
      expectEqual("the other search is untouched", await freq(other.id), "daily");
      const twice = await unsubPost(new Request(link, { method: "POST", body: "List-Unsubscribe=One-Click" }));
      expectEqual("one-click POST works and a repeat is harmless", [twice.status, await freq(mine.id)], [200, "off"]);
      const gone = await unsubGet(new Request(buildUnsubscribeUrl("https://example.test", "deleted-search", "en")));
      expectEqual("a deleted search still gets a calm 200 page", gone.status, 200);
      await resetSearches();
    }

    // ---------------- 9. homes with no spot match by their area's centre ----------------
    {
      const centred = await prisma.neighborhood.create({
        data: { slug: `${TAG}-centre`, nameEn: "Centred", nameAr: "وسط", cityId: city.id, lat: 23.6, lng: 58.4 },
      });
      hoods.push(centred.id);
      const bare = await newHood("nocentre"); // no coordinates at all
      const u = await newUser("approx", "en");
      const homeA = await newListing(centred.id, { published: at(-HOUR), title: "Centre villa" });
      await newListing(bare.id, { published: at(-HOUR), title: "Nowhere villa" });
      const inside = "&n=23.7&s=23.5&e=58.5&w=58.3";
      const outside = "&n=18&s=17&e=55&w=54";
      const sIn = await prisma.savedSearch.create({
        data: { userId: u.id, name: "Inside", query: `type=VILLA${inside}`, frequency: "instant", createdAt: at(-2 * HOUR) },
      });
      const sOut = await prisma.savedSearch.create({
        data: { userId: u.id, name: "Outside", query: `type=VILLA${outside}`, frequency: "instant", createdAt: at(-2 * HOUR) },
      });
      const r = await run(at(7 * HOUR));
      expectEqual("a home with no spot alerts for the area holding its neighbourhood centre only", [r.sent, sent.length, sent[0]?.subject.includes("Inside")], [1, 1, true]);
      expectEqual("the area search lists it, but not the home in a neighbourhood with no centre",
        [sent[0].text.includes("Centre villa"), sent[0].text.includes("Nowhere villa")], [true, false]);
      expectEqual("the other area got nothing", (await get(sOut.id)).lastAlertedAt, null);
      void sIn;
      const prop = await prisma.property.findUniqueOrThrow({ where: { id: homeA.propertyId } });
      expectEqual("the centre is never written onto the home", [prop.lat, prop.lng], [null, null]);
      await resetSearches();
    }
  } finally {
    await prisma.alertLog.deleteMany({ where: { userId: { in: users } } });
    await prisma.savedSearch.deleteMany({ where: { userId: { in: users } } });
    await prisma.listing.deleteMany({ where: { property: { neighborhoodId: { in: hoods } } } });
    await prisma.property.deleteMany({ where: { neighborhoodId: { in: hoods } } });
    await prisma.neighborhood.deleteMany({ where: { id: { in: hoods } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.city.deleteMany({ where: { id: city.id } });
    await prisma.governorate.deleteMany({ where: { id: gov.id } });
  }
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failures > 0) {
      console.error(`${failures} check(s) failed`);
      process.exit(1);
    }
  });
