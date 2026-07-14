import { PrismaClient, PropertyType, OwnershipEligibility } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seed data. IMPORTANT: market figures below are ballpark SAMPLE values so the
// dashboard demonstrates itself. They are labeled USER_SUBMITTED / AI_ESTIMATED
// with "sample data" source notes and low confidence — never VERIFIED or
// OFFICIAL_STAT. Real data entered by the owner replaces them over time.
// ---------------------------------------------------------------------------

const GOVERNORATES = [
  { slug: "muscat", nameEn: "Muscat", nameAr: "مسقط" },
  { slug: "dhofar", nameEn: "Dhofar", nameAr: "ظفار" },
];

const CITIES = [
  { slug: "seeb", nameEn: "Seeb", nameAr: "السيب", governorate: "muscat" },
  { slug: "bawshar", nameEn: "Bawshar", nameAr: "بوشر", governorate: "muscat" },
  { slug: "muttrah", nameEn: "Muttrah", nameAr: "مطرح", governorate: "muscat" },
  { slug: "salalah", nameEn: "Salalah", nameAr: "صلالة", governorate: "dhofar" },
];

type SeedNeighborhood = {
  slug: string;
  nameEn: string;
  nameAr: string;
  city: string;
  lat: number;
  lng: number;
  isITC?: boolean;
  // sample baselines for generated stats (OMR)
  apt?: { price: number; rent: number; sqm: number };
  villa?: { price: number; rent: number; sqm: number };
};

const NEIGHBORHOODS: SeedNeighborhood[] = [
  {
    slug: "al-mouj", nameEn: "Al Mouj", nameAr: "الموج", city: "seeb",
    lat: 23.6435, lng: 58.2645, isITC: true,
    apt: { price: 120_000, rent: 650, sqm: 105 },
    villa: { price: 400_000, rent: 1_800, sqm: 320 },
  },
  {
    slug: "muscat-hills", nameEn: "Muscat Hills", nameAr: "تلال مسقط", city: "seeb",
    lat: 23.6010, lng: 58.2985, isITC: true,
    apt: { price: 85_000, rent: 500, sqm: 100 },
    villa: { price: 300_000, rent: 1_400, sqm: 300 },
  },
  {
    slug: "al-hail", nameEn: "Al Hail", nameAr: "الحيل", city: "seeb",
    lat: 23.6470, lng: 58.1960,
    apt: { price: 40_000, rent: 280, sqm: 95 },
    villa: { price: 160_000, rent: 700, sqm: 300 },
  },
  {
    slug: "qurum", nameEn: "Qurum", nameAr: "القرم", city: "bawshar",
    lat: 23.6090, lng: 58.4780,
    apt: { price: 70_000, rent: 450, sqm: 100 },
    villa: { price: 350_000, rent: 1_500, sqm: 350 },
  },
  {
    slug: "al-khuwair", nameEn: "Al Khuwair", nameAr: "الخوير", city: "bawshar",
    lat: 23.6000, lng: 58.4350,
    apt: { price: 55_000, rent: 375, sqm: 95 },
    villa: { price: 200_000, rent: 900, sqm: 300 },
  },
  {
    slug: "ghubrah", nameEn: "Al Ghubrah", nameAr: "الغبرة", city: "bawshar",
    lat: 23.5940, lng: 58.4000,
    apt: { price: 60_000, rent: 400, sqm: 100 },
    villa: { price: 220_000, rent: 1_000, sqm: 310 },
  },
  {
    slug: "madinat-sultan-qaboos", nameEn: "Madinat Sultan Qaboos", nameAr: "مدينة السلطان قابوس", city: "bawshar",
    lat: 23.5985, lng: 58.4266,
    apt: { price: 75_000, rent: 500, sqm: 105 },
    villa: { price: 320_000, rent: 1_400, sqm: 340 },
  },
  {
    slug: "bausher", nameEn: "Bausher", nameAr: "بوشر", city: "bawshar",
    lat: 23.5770, lng: 58.3990,
    apt: { price: 45_000, rent: 300, sqm: 95 },
    villa: { price: 180_000, rent: 750, sqm: 300 },
  },
  {
    slug: "ruwi", nameEn: "Ruwi", nameAr: "روي", city: "muttrah",
    lat: 23.5940, lng: 58.5450,
    apt: { price: 35_000, rent: 250, sqm: 85 },
  },
  {
    slug: "salalah-center", nameEn: "Salalah Center", nameAr: "وسط صلالة", city: "salalah",
    lat: 17.0190, lng: 54.0890,
    apt: { price: 30_000, rent: 200, sqm: 95 },
    villa: { price: 120_000, rent: 500, sqm: 320 },
  },
  {
    slug: "hawana-salalah", nameEn: "Hawana Salalah", nameAr: "هوانا صلالة", city: "salalah",
    lat: 17.0370, lng: 54.2420, isITC: true,
    apt: { price: 90_000, rent: 550, sqm: 100 },
    villa: { price: 280_000, rent: 1_300, sqm: 300 },
  },
];

const MONTHS_OF_HISTORY = 24;
// Fixed anchor so re-running the seed is idempotent.
const LAST_PERIOD = new Date(Date.UTC(2026, 5, 1)); // June 2026

/** Deterministic gentle trend: ~3%/year growth plus a small seasonal wobble. */
function trendFactor(monthsAgo: number, phase: number): number {
  const growth = Math.pow(1.03, -monthsAgo / 12);
  const wobble = 1 + 0.015 * Math.sin((monthsAgo + phase) / 3.5);
  return growth * wobble;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

async function main() {
  console.log("Seeding…");

  // --- Admin user -----------------------------------------------------------
  // This password is used for BOTH the seeded admin and the sample agency
  // login below. Refuse to seed with a missing, placeholder, or short
  // password — otherwise those two public logins would be easy to guess.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword === "change-me" || adminPassword.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is missing or still the \"change-me\" placeholder. " +
        "Set a strong password (at least 12 characters) in .env before seeding — " +
        "it protects both the admin and the sample agency login.",
    );
  }
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@example.com",
      name: "Owner",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  // --- Locations -------------------------------------------------------------
  const govIds = new Map<string, string>();
  for (const g of GOVERNORATES) {
    const row = await prisma.governorate.upsert({
      where: { slug: g.slug },
      update: { nameEn: g.nameEn, nameAr: g.nameAr },
      create: g,
    });
    govIds.set(g.slug, row.id);
  }

  const cityIds = new Map<string, string>();
  for (const c of CITIES) {
    const row = await prisma.city.upsert({
      where: { slug: c.slug },
      update: { nameEn: c.nameEn, nameAr: c.nameAr },
      create: {
        slug: c.slug,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        governorateId: govIds.get(c.governorate)!,
      },
    });
    cityIds.set(c.slug, row.id);
  }

  const hoodIds = new Map<string, string>();
  for (const n of NEIGHBORHOODS) {
    const row = await prisma.neighborhood.upsert({
      where: { slug: n.slug },
      update: {
        nameEn: n.nameEn,
        nameAr: n.nameAr,
        lat: n.lat,
        lng: n.lng,
        isITC: n.isITC ?? false,
      },
      create: {
        slug: n.slug,
        nameEn: n.nameEn,
        nameAr: n.nameAr,
        cityId: cityIds.get(n.city)!,
        lat: n.lat,
        lng: n.lng,
        isITC: n.isITC ?? false,
      },
    });
    hoodIds.set(n.slug, row.id);
  }

  // --- Market stats (sample history) ------------------------------------------
  let statCount = 0;
  for (const [hoodIndex, n] of NEIGHBORHOODS.entries()) {
    const segments: Array<[PropertyType, NonNullable<SeedNeighborhood["apt"]>]> = [];
    if (n.apt) segments.push([PropertyType.APARTMENT, n.apt]);
    if (n.villa) segments.push([PropertyType.VILLA, n.villa]);

    for (const [type, base] of segments) {
      for (let m = 0; m < MONTHS_OF_HISTORY; m++) {
        const periodStart = new Date(
          Date.UTC(LAST_PERIOD.getUTCFullYear(), LAST_PERIOD.getUTCMonth() - m, 1),
        );
        const f = trendFactor(m, hoodIndex * 2 + (type === "VILLA" ? 1 : 0));
        const price = round3(base.price * f);
        const rent = round3(base.rent * f);
        const yieldPct = Math.round(((rent * 12) / price) * 10000) / 100;

        const existing = await prisma.marketStat.findFirst({
          where: {
            neighborhoodId: hoodIds.get(n.slug)!,
            propertyType: type,
            periodStart,
            governorateId: null,
            cityId: null,
          },
          select: { id: true },
        });
        if (existing) continue;

        // Recent 6 months labeled as AI estimates, older as sample submissions —
        // both clearly marked as sample data. No fake "official" figures.
        const recent = m < 6;
        await prisma.marketStat.create({
          data: {
            neighborhoodId: hoodIds.get(n.slug)!,
            propertyType: type,
            periodStart,
            avgSalePrice: price,
            avgRentMonthly: rent,
            avgPricePerSqm: round3(price / base.sqm),
            grossYieldPct: yieldPct,
            sampleSize: 8 + ((hoodIndex + m) % 7),
            provenance: recent ? "AI_ESTIMATED" : "USER_SUBMITTED",
            confidence: recent ? 0.35 : 0.4,
            sourceNote: "Sample data for demonstration — replace with real figures.",
          },
        });
        statCount++;
      }
    }
  }

  // --- Sample properties -------------------------------------------------------
  const SAMPLE_PROPERTIES: Array<{
    hood: string;
    type: PropertyType;
    titleEn: string;
    titleAr: string;
    beds: number | null;
    baths: number | null;
    sqm: number;
    year: number;
    dLat: number;
    dLng: number;
  }> = [
    { hood: "al-mouj", type: "APARTMENT", titleEn: "2BR marina-view apartment, Al Mouj", titleAr: "شقة غرفتين بإطلالة على المارينا، الموج", beds: 2, baths: 2, sqm: 110, year: 2019, dLat: 0.002, dLng: 0.003 },
    { hood: "al-mouj", type: "APARTMENT", titleEn: "1BR garden apartment, Al Mouj", titleAr: "شقة غرفة واحدة مع حديقة، الموج", beds: 1, baths: 1, sqm: 75, year: 2021, dLat: -0.001, dLng: 0.004 },
    { hood: "al-mouj", type: "VILLA", titleEn: "4BR golf-course villa, Al Mouj", titleAr: "فيلا 4 غرف على ملعب الجولف، الموج", beds: 4, baths: 5, sqm: 380, year: 2018, dLat: 0.003, dLng: -0.002 },
    { hood: "muscat-hills", type: "VILLA", titleEn: "3BR villa with pool, Muscat Hills", titleAr: "فيلا 3 غرف مع مسبح، تلال مسقط", beds: 3, baths: 4, sqm: 310, year: 2016, dLat: 0.001, dLng: 0.002 },
    { hood: "muscat-hills", type: "APARTMENT", titleEn: "2BR fairway apartment, Muscat Hills", titleAr: "شقة غرفتين مطلة على الملعب، تلال مسقط", beds: 2, baths: 2, sqm: 105, year: 2017, dLat: -0.002, dLng: 0.001 },
    { hood: "qurum", type: "VILLA", titleEn: "5BR family villa near Qurum beach", titleAr: "فيلا عائلية 5 غرف قرب شاطئ القرم", beds: 5, baths: 6, sqm: 420, year: 2010, dLat: 0.002, dLng: 0.002 },
    { hood: "qurum", type: "APARTMENT", titleEn: "3BR apartment, Qurum heights", titleAr: "شقة 3 غرف، مرتفعات القرم", beds: 3, baths: 3, sqm: 140, year: 2014, dLat: -0.001, dLng: -0.003 },
    { hood: "al-khuwair", type: "APARTMENT", titleEn: "2BR apartment near ministries, Al Khuwair", titleAr: "شقة غرفتين قرب الوزارات، الخوير", beds: 2, baths: 2, sqm: 95, year: 2015, dLat: 0.001, dLng: 0.001 },
    { hood: "ghubrah", type: "APARTMENT", titleEn: "2BR apartment, Al Ghubrah North", titleAr: "شقة غرفتين، الغبرة الشمالية", beds: 2, baths: 2, sqm: 100, year: 2018, dLat: 0.002, dLng: -0.001 },
    { hood: "madinat-sultan-qaboos", type: "VILLA", titleEn: "4BR villa, Madinat Sultan Qaboos", titleAr: "فيلا 4 غرف، مدينة السلطان قابوس", beds: 4, baths: 4, sqm: 350, year: 2008, dLat: -0.002, dLng: 0.002 },
    { hood: "bausher", type: "APARTMENT", titleEn: "1BR apartment, Bausher", titleAr: "شقة غرفة واحدة، بوشر", beds: 1, baths: 1, sqm: 70, year: 2020, dLat: 0.001, dLng: 0.003 },
    { hood: "al-hail", type: "VILLA", titleEn: "3BR townhouse-style villa, Al Hail South", titleAr: "فيلا بطراز تاون هاوس 3 غرف، الحيل الجنوبية", beds: 3, baths: 3, sqm: 280, year: 2019, dLat: -0.001, dLng: 0.002 },
    { hood: "ruwi", type: "APARTMENT", titleEn: "2BR apartment, Ruwi high street", titleAr: "شقة غرفتين، شارع روي الرئيسي", beds: 2, baths: 1, sqm: 85, year: 2005, dLat: 0.001, dLng: -0.001 },
    { hood: "salalah-center", type: "VILLA", titleEn: "4BR villa, central Salalah", titleAr: "فيلا 4 غرف، وسط صلالة", beds: 4, baths: 4, sqm: 340, year: 2012, dLat: 0.002, dLng: 0.001 },
    { hood: "hawana-salalah", type: "APARTMENT", titleEn: "1BR lagoon apartment, Hawana Salalah", titleAr: "شقة غرفة واحدة على البحيرة، هوانا صلالة", beds: 1, baths: 1, sqm: 80, year: 2019, dLat: 0.001, dLng: 0.002 },
    { hood: "hawana-salalah", type: "VILLA", titleEn: "3BR beach villa, Hawana Salalah", titleAr: "فيلا شاطئية 3 غرف، هوانا صلالة", beds: 3, baths: 3, sqm: 290, year: 2020, dLat: -0.001, dLng: 0.003 },
  ];

  let propCount = 0;
  for (const p of SAMPLE_PROPERTIES) {
    const existing = await prisma.property.findFirst({
      where: { titleEn: p.titleEn },
      select: { id: true },
    });
    if (existing) continue;

    const hood = NEIGHBORHOODS.find((n) => n.slug === p.hood)!;
    const ownership: OwnershipEligibility = hood.isITC
      ? "FOREIGN_ITC"
      : "OMANI_ONLY";

    await prisma.property.create({
      data: {
        neighborhoodId: hoodIds.get(p.hood)!,
        type: p.type,
        ownership,
        titleEn: p.titleEn,
        titleAr: p.titleAr,
        bedrooms: p.beds,
        bathrooms: p.baths,
        areaSqm: p.sqm,
        yearBuilt: p.year,
        lat: hood.lat + p.dLat,
        lng: hood.lng + p.dLng,
        provenance: "USER_SUBMITTED",
        confidence: 0.6,
        sourceNote: "Sample record for demonstration.",
      },
    });
    propCount++;
  }

  // --- Sample listings & valuations (Phase 3) --------------------------------
  // Deterministic assignment over the seeded properties (sorted by titleEn):
  // 8 SALE + 6 RENT active, 2 pending review, 1 draft, 1 sold. Two properties
  // carry both a SALE and a RENT listing. Prices are scaled from the same
  // neighborhood baselines as the market stats so the numbers reconcile.
  // Everything is honestly labeled sample data — never VERIFIED/OFFICIAL_STAT.
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    select: { id: true },
  });
  const allProps = await prisma.property.findMany({
    orderBy: { titleEn: "asc" },
    include: { neighborhood: { select: { slug: true } } },
  });

  function baseline(p: (typeof allProps)[number]) {
    const hood = NEIGHBORHOODS.find((n) => n.slug === p.neighborhood.slug);
    return p.type === "VILLA" ? hood?.villa : hood?.apt;
  }
  function salePrice(p: (typeof allProps)[number]): number {
    const b = baseline(p);
    if (!b) return 50_000;
    const sqm = p.areaSqm ? Number(p.areaSqm) : b.sqm;
    return Math.round((b.price * (sqm / b.sqm)) / 500) * 500;
  }
  function rentPrice(p: (typeof allProps)[number]): number {
    const b = baseline(p);
    if (!b) return 300;
    const sqm = p.areaSqm ? Number(p.areaSqm) : b.sqm;
    return Math.round((b.rent * (sqm / b.sqm)) / 5) * 5;
  }

  type ListingSpec = {
    propIdx: number;
    listingType: "SALE" | "RENT";
    status: "ACTIVE" | "PENDING_REVIEW" | "DRAFT" | "SOLD";
  };
  const LISTING_SPECS: ListingSpec[] = [
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      propIdx: i, listingType: "SALE" as const, status: "ACTIVE" as const,
    })),
    ...[8, 9, 10, 11, 12].map((i) => ({
      propIdx: i, listingType: "RENT" as const, status: "ACTIVE" as const,
    })),
    { propIdx: 0, listingType: "RENT", status: "ACTIVE" }, // 6th active rent
    { propIdx: 13, listingType: "SALE", status: "PENDING_REVIEW" },
    { propIdx: 1, listingType: "RENT", status: "PENDING_REVIEW" },
    { propIdx: 14, listingType: "SALE", status: "DRAFT" },
    { propIdx: 15, listingType: "SALE", status: "SOLD" },
  ];

  const PUBLISHED = new Date(Date.UTC(2026, 4, 15)); // fixed for idempotency
  let listingCount = 0;
  if (admin) {
    for (const spec of LISTING_SPECS) {
      const prop = allProps[spec.propIdx];
      if (!prop) continue;
      const existing = await prisma.listing.findFirst({
        where: { propertyId: prop.id, listingType: spec.listingType },
        select: { id: true },
      });
      if (existing) continue;

      const isRent = spec.listingType === "RENT";
      await prisma.listing.create({
        data: {
          propertyId: prop.id,
          listingType: spec.listingType,
          price: isRent ? rentPrice(prop) : salePrice(prop),
          rentPeriod: isRent ? "MONTHLY" : null,
          status: spec.status,
          createdById: admin.id,
          provenance: "USER_SUBMITTED",
          confidence: 0.5,
          publishedAt:
            spec.status === "ACTIVE" || spec.status === "SOLD" ? PUBLISHED : null,
          expiresAt:
            spec.status === "SOLD" ? new Date(Date.UTC(2026, 5, 20)) : null,
        },
      });
      listingCount++;
    }
  }

  // 6 valuations on alternating properties, so the MarketStat-fallback path
  // in propertyFinancials() stays exercised on the rest.
  let valuationCount = 0;
  for (const [i, propIdx] of [0, 2, 4, 6, 8, 10].entries()) {
    const prop = allProps[propIdx];
    if (!prop) continue;
    const method = i % 2 === 0 ? "COMPARABLE" : "AI_MODEL";
    const existing = await prisma.valuationEstimate.findFirst({
      where: { propertyId: prop.id, method },
      select: { id: true },
    });
    if (existing) continue;

    const mid = Math.round((salePrice(prop) * (0.97 + 0.01 * i)) / 100) * 100;
    await prisma.valuationEstimate.create({
      data: {
        propertyId: prop.id,
        method,
        valueLow: Math.round(mid * 0.92),
        valueMid: mid,
        valueHigh: Math.round(mid * 1.08),
        provenance: "AI_ESTIMATED",
        confidence: 0.3 + 0.03 * i,
        assumptions:
          "Sample AI-estimated valuation for demonstration; not a professional appraisal.",
      },
    });
    valuationCount++;
  }

  // ---------- Phase 5: a sample agency, its login, a listing, an enquiry ----------
  // So the agency portal and the admin/agency inboxes are demoable out of the box.
  const agency = await prisma.agency.upsert({
    where: { slug: "bay-estates" },
    update: {},
    create: {
      slug: "bay-estates",
      nameEn: "Bay Estates",
      nameAr: "عقارات الخليج",
      licenseNo: "OM-RE-2024-0142",
      email: "hello@bayestates.example",
      phone: "+968 2400 0000",
      isApproved: true,
      tier: "PREMIUM",
    },
  });

  await prisma.user.upsert({
    where: { email: "agency@example.com" },
    update: {},
    create: {
      name: "Bay Estates Team",
      email: "agency@example.com",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "AGENCY",
      tier: "PREMIUM",
      agencyId: agency.id,
    },
  });

  // Hand the agency one live listing so its portal isn't empty.
  const someActive = await prisma.listing.findFirst({
    where: { status: "ACTIVE", agencyId: null },
    orderBy: { createdAt: "asc" },
    include: { property: true },
  });
  if (someActive) {
    await prisma.listing.update({
      where: { id: someActive.id },
      data: { agencyId: agency.id },
    });

    // A sample enquiry on that listing.
    const existingInquiry = await prisma.inquiry.findFirst({
      where: { listingId: someActive.id },
      select: { id: true },
    });
    if (!existingInquiry) {
      await prisma.inquiry.create({
        data: {
          listingId: someActive.id,
          name: "Sample Buyer",
          email: "buyer@example.com",
          phone: "+968 9000 0000",
          message:
            "Is this still available? I'd like to arrange a viewing this week.",
          status: "NEW",
        },
      });
    }
  }

  console.log(
    `Done. ${GOVERNORATES.length} governorates, ${CITIES.length} cities, ${NEIGHBORHOODS.length} neighborhoods, +${statCount} market stats, +${propCount} properties, +${listingCount} listings, +${valuationCount} valuations, +1 sample agency (agency@example.com), +1 sample enquiry.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
