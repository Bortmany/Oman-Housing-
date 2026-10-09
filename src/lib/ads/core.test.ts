// Ads core - database-backed tests. Run with: npm test (uses the _test database).
// Live lookup, overlap refusal, atomic counting per Oman day, pause/resume.

export {}; // makes this file its own module

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

  const run = `ad${Date.now()}`;
  const gov = await prisma.governorate.create({ data: { slug: `${run}-g`, nameEn: "G", nameAr: "ح" } });
  const city = await prisma.city.create({ data: { slug: `${run}-c`, nameEn: "C", nameAr: "م", governorateId: gov.id } });
  const hoodA = await prisma.neighborhood.create({ data: { slug: `${run}-a`, nameEn: "A", nameAr: "أ", cityId: city.id } });
  const hoodB = await prisma.neighborhood.create({ data: { slug: `${run}-b`, nameEn: "B", nameAr: "ب", cityId: city.id } });

  const H = 3600 * 1000;
  const now = new Date();
  const base = (over: Record<string, unknown> = {}) => ({
    advertiser: "Test Co",
    slot: "HOME_BAND" as const,
    neighborhoodId: null as string | null,
    linkUrl: "https://example.com",
    altEn: "Alt",
    altAr: null,
    startsAt: new Date(now.getTime() - H),
    endsAt: new Date(now.getTime() + H),
    agreedPrice: "60.000" as string | null,
    ...over,
  });
  const imgs = { imageEnPath: "ads/x/en.png", imageArPath: null };

  try {
    // Isolate from anything else in the test database.
    await prisma.adCampaign.deleteMany({});

    expectEqual("no campaign -> nothing live", await core.findLiveCampaign("HOME_BAND", undefined), null);

    const first = await core.createCampaign(`${run}-1`, base(), imgs);
    expectEqual("first campaign created", first.ok, true);
    expectEqual("it is live now", (await core.findLiveCampaign("HOME_BAND", undefined))?.id, `${run}-1`);
    expectEqual("agreed price stored to 3 decimals", (await prisma.adCampaign.findUnique({ where: { id: `${run}-1` } }))?.agreedPrice?.toString(), "60");

    const clash = await core.createCampaign(`${run}-2`, base(), imgs);
    expectEqual("same slot, overlapping dates refused", clash, { ok: false, error: "overlap" });
    expectEqual("refused campaign was not stored", await prisma.adCampaign.count(), 1);

    const later = await core.createCampaign(`${run}-3`, base({ startsAt: new Date(now.getTime() + H), endsAt: new Date(now.getTime() + 3 * H) }), imgs);
    expectEqual("same slot, later dates accepted", later.ok, true);
    expectEqual("the later one is not live yet", (await core.findLiveCampaign("HOME_BAND", undefined))?.id, `${run}-1`);

    // Per-area slot: own area only.
    const sponsorA = await core.createCampaign(`${run}-4`, base({ slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: hoodA.id }), imgs);
    expectEqual("sponsor for area A created", sponsorA.ok, true);
    expectEqual("area B has no sponsor", await core.findLiveCampaign("NEIGHBORHOOD_SPONSOR", hoodB.id), null);
    expectEqual("area A has its sponsor", (await core.findLiveCampaign("NEIGHBORHOOD_SPONSOR", hoodA.id))?.id, `${run}-4`);
    const sponsorB = await core.createCampaign(`${run}-5`, base({ slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: hoodB.id }), imgs);
    expectEqual("area B can have its own sponsor at the same time", sponsorB.ok, true);
    expectEqual("unknown area refused", await core.createCampaign(`${run}-6`, base({ slot: "NEIGHBORHOOD_SPONSOR", neighborhoodId: "nope" }), imgs), { ok: false, error: "neighborhood" });

    // Pause / resume.
    expectEqual("pause works", (await core.setCampaignActive(`${run}-1`, false)).ok, true);
    expectEqual("paused -> nothing live", await core.findLiveCampaign("HOME_BAND", undefined), null);
    const taker = await core.createCampaign(`${run}-7`, base(), imgs);
    expectEqual("a paused campaign does not block the slot", taker.ok, true);
    expectEqual("resuming over a new holder is refused", await core.setCampaignActive(`${run}-1`, true), { ok: false, error: "overlap" });
    expectEqual("editing keeps its own slot (no self clash)", (await core.updateCampaign(`${run}-7`, base({ advertiser: "Renamed" }), {}, true)).ok, true);

    // Counting: many at once, one atomic statement each.
    const t = new Date("2026-10-10T21:30:00Z"); // 01:30 on 11 Oct in Oman
    await Promise.all(Array.from({ length: 25 }, () => core.recordAdView(`${run}-7`, t)));
    await Promise.all(Array.from({ length: 4 }, () => core.recordAdClick(`${run}-7`, t)));
    await core.recordAdView(`${run}-7`, new Date("2026-10-10T10:00:00Z")); // 14:00 on 10 Oct
    const rows = await prisma.adDailyStat.findMany({ where: { campaignId: `${run}-7` }, orderBy: { day: "asc" } });
    expectEqual("two Oman days, one row each", rows.map((r) => r.day.toISOString().slice(0, 10)), ["2026-10-10", "2026-10-11"]);
    expectEqual("25 simultaneous views all counted", [rows[1].views, rows[1].clicks], [25, 4]);
    expectEqual("earlier day kept apart", [rows[0].views, rows[0].clicks], [1, 0]);
    const totals = await core.campaignTotals([`${run}-7`]);
    expectEqual("totals add the days up", totals.get(`${run}-7`), { views: 26, clicks: 4 });
    expectEqual("live count sees live campaigns only", await core.countLiveCampaigns(), 3);
  } finally {
    await prisma.adCampaign.deleteMany({ where: { id: { startsWith: run } } });
    await prisma.neighborhood.deleteMany({ where: { id: { in: [hoodA.id, hoodB.id] } } });
    await prisma.city.delete({ where: { id: city.id } });
    await prisma.governorate.delete({ where: { id: gov.id } });
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} ads core test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAds core tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
