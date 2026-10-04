import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { publicPropertyWhere } from "@/lib/listings/rules";
import { getSiteUrl } from "@/lib/siteUrl";
import { buildSitemapEntries, MAX_SITEMAP_PROPERTIES } from "@/lib/sitemap";

// Built on request, not at build time: it reads the database.
export const dynamic = "force-dynamic";

// Loads data only; every "what is allowed in" rule lives in buildSitemapEntries.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  // No known public address (production, AUTH_URL unset): publish nothing
  // rather than localhost addresses.
  if (!base) return [];

  const [hoods, properties] = await Promise.all([
    // A neighbourhood with only sample figures would show only sample data.
    prisma.neighborhood.findMany({
      where: { marketStats: { some: { isSample: false } } },
      select: { slug: true },
      orderBy: { slug: "asc" },
    }),
    prisma.property.findMany({
      where: {
        AND: [
          publicPropertyWhere,
          { isSample: false },
          { listings: { some: { status: "ACTIVE", isSample: false } } },
        ],
      },
      select: {
        id: true,
        isSample: true,
        updatedAt: true,
        listings: { select: { status: true, isSample: true, updatedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_SITEMAP_PROPERTIES,
    }),
  ]);

  return buildSitemapEntries(
    { neighborhoodSlugs: hoods.map((h) => h.slug), properties },
    base,
  );
}
