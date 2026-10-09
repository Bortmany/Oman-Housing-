// Featured placement in search, against the TEST database: up to 3 featured
// live listings lead, only they carry the Featured mark, expired / not-live /
// sample ones never get a slot, filters still apply, a featured listing older
// than the newest page still appears, nothing twice, and plain searchListings
// (used by alerts) is unchanged. Run with: npm test
export {}; // makes this file a module, so its helpers stay private

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
  const { searchListings, searchListingsFeaturedFirst } = await import("./listings");
  const { hourStamp, pickFeatured } = await import("@/lib/featured");

  const run = `fs${Date.now()}`;
  const DAY = 24 * 3600 * 1000;
  const now = new Date();
  const gov = await prisma.governorate.create({ data: { slug: `${run}-g`, nameEn: "G", nameAr: "ح" } });
  const city = await prisma.city.create({ data: { slug: `${run}-c`, nameEn: "C", nameAr: "م", governorateId: gov.id } });
  const hood = await prisma.neighborhood.create({ data: { slug: `${run}-n`, nameEn: "N", nameAr: "ن", cityId: city.id } });
  const user = await prisma.user.create({ data: { email: `${run}@example.com` } });

  let minute = 0; // later = newer
  const mk = async (name: string, over: Record<string, unknown> = {}) => {
    const property = await prisma.property.create({
      data: { neighborhoodId: hood.id, type: "VILLA", titleEn: `${run}-${name}` },
    });
    return prisma.listing.create({
      data: {
        propertyId: property.id, listingType: "SALE", price: "100000.000", status: "ACTIVE",
        createdById: user.id, publishedAt: new Date(now.getTime() - 3 * DAY + ++minute * 60_000), ...over,
      },
    });
  };
  const future = new Date(now.getTime() + 10 * DAY);
  const filters = { neighborhoodSlug: hood.slug };
  const nameOf = (l: { property: { titleEn: string } }) => l.property.titleEn.replace(`${run}-`, "");

  try {
    // Oldest first, so the featured ones are the OLDEST (outside a small "newest" page).
    const f = [];
    for (const n of ["f1", "f2", "f3", "f4", "f5"]) f.push(await mk(n, { featuredUntil: future }));
    const normal = [];
    for (const n of ["n1", "n2", "n3", "n4"]) normal.push(await mk(n));
    // Things that must never get a featured slot.
    const expired = await mk("expired", { featuredUntil: new Date(now.getTime() - 1000) });
    const inReview = await mk("inReview", { status: "PENDING_REVIEW", featuredUntil: future });
    const archived = await mk("archived", { status: "ARCHIVED", featuredUntil: future });
    const withdrawn = await mk("sold", { status: "SOLD", featuredUntil: future });
    const sampleFeatured = await mk("sampleF", { isSample: true, featuredUntil: future });
    const rentFeatured = await mk("rentF", { listingType: "RENT", rentPeriod: "MONTHLY", featuredUntil: future });

    const { listings, featuredIds } = await searchListingsFeaturedFirst(filters, now);
    const names = listings.map(nameOf);
    const ids = listings.map((l) => l.id);

    expectEqual("exactly 3 are featured", featuredIds.size, 3);
    expectEqual("the 3 lead the results", ids.slice(0, 3).every((id) => featuredIds.has(id)), true);
    expectEqual("only the leading 3 are marked featured", ids.slice(3).some((id) => featuredIds.has(id)), false);
    expectEqual("the leaders are chosen by the hourly rotation", ids.slice(0, 3).sort(), pickFeatured(f.concat(rentFeatured), hourStamp(now), 3, now).map((x) => x.id).sort());
    expectEqual("nothing appears twice", new Set(ids).size, ids.length);
    expectEqual("never-featured kinds are absent from the lead", ["expired", "inReview", "archived", "sold", "sampleF"].some((n) => names.slice(0, 3).includes(n)), false);
    expectEqual("not-live listings are not in the results at all", ["inReview", "archived", "sold"].some((n) => names.includes(n)), false);
    expectEqual("an expired featured listing sits in normal order", names.includes("expired") && !featuredIds.has(expired.id), true);
    expectEqual("featured listings beyond the 3 sit in normal order, unmarked", listings.filter((l) => !featuredIds.has(l.id) && /^(f\d|rentF)$/.test(nameOf(l))).length, f.length + 1 - 3);
    expectEqual("normal order after the leaders is newest first", ids.slice(3).map((id) => listings.find((l) => l.id === id)!.publishedAt!.getTime()).every((t, i, a) => i === 0 || a[i - 1] >= t), true);
    expectEqual("total = every live real listing once (the sample one is hidden)", ids.length, f.length + normal.length + 1 + 1); // f* + n* + expired + rentF
    expectEqual("a featured sample record never appears", names.includes("sampleF"), false);
    void sampleFeatured; void inReview; void archived; void withdrawn;

    // Filters still apply to the featured block.
    const rentOnly = await searchListingsFeaturedFirst({ ...filters, listingType: "RENT" }, now);
    expectEqual("filters apply: only the matching featured listing leads", [rentOnly.listings.map(nameOf), rentOnly.featuredIds.size], [["rentF"], 1]);
    const saleOnly = await searchListingsFeaturedFirst({ ...filters, listingType: "SALE" }, now);
    expectEqual("filters apply: a RENT featured listing is not in SALE results", saleOnly.listings.some((l) => l.id === rentFeatured.id), false);

    // A featured listing older than the newest page still appears (limit 5 < 11 matches).
    const small = await searchListingsFeaturedFirst({ ...filters, limit: 5 }, now);
    expectEqual("limit is respected", small.listings.length, 5);
    expectEqual("old featured listings still lead a short page", small.listings.slice(0, 3).every((l) => small.featuredIds.has(l.id)), true);
    expectEqual("short page: nothing twice", new Set(small.listings.map((l) => l.id)).size, 5);

    // Rotation changes across hours but stays within the cap.
    const leaderSets = new Set<string>();
    for (let h = 0; h < 24; h++) {
      const at = new Date(now.getTime() + h * 3600 * 1000);
      const r = await searchListingsFeaturedFirst(filters, at);
      leaderSets.add([...r.featuredIds].sort().join(","));
      if (r.featuredIds.size > 3) leaderSets.add("TOO MANY");
    }
    expectEqual("the lead set rotates across hours", leaderSets.size > 1, true);
    expectEqual("never more than 3 in any hour", leaderSets.has("TOO MANY"), false);
    const again = await searchListingsFeaturedFirst(filters, now);
    expectEqual("same hour, same order", again.listings.map((l) => l.id), ids);

    // After the featured time ends, they are ordinary.
    const later = await searchListingsFeaturedFirst(filters, new Date(future.getTime() + 1000));
    expectEqual("featuring ends by itself (no job needed)", later.featuredIds.size, 0);

    // Honesty: the rows come back exactly as stored.
    const stored = await prisma.listing.findMany({ where: { id: { in: ids } } });
    expectEqual("featuring changed no label, status or price", listings.every((l) => {
      const s = stored.find((x) => x.id === l.id)!;
      return s.provenance === l.provenance && s.confidence === l.confidence && s.status === l.status && s.price.toString() === l.price.toString();
    }), true);

    // Plain search (alerts, neighbourhood pages) is untouched: newest first, no featured priority.
    const plain = await searchListings(filters);
    const times = plain.map((l) => l.publishedAt!.getTime());
    expectEqual("plain searchListings is still newest first", times.every((t, i) => i === 0 || times[i - 1] >= t), true);
    expectEqual("plain searchListings has no featured priority", plain.slice(0, 3).some((l) => /^f\d$/.test(nameOf(l))), false);
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await prisma.listing.deleteMany({ where: { createdById: user.id } });
    await prisma.property.deleteMany({ where: { neighborhoodId: hood.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.neighborhood.deleteMany({ where: { id: hood.id } });
    await prisma.city.deleteMany({ where: { id: city.id } });
    await prisma.governorate.deleteMany({ where: { id: gov.id } });
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} featured-search test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll featured-search tests passed.");
}

main();
