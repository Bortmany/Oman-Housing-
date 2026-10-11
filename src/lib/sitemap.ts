// Pure sitemap builder: takes plain lists, returns sitemap entries. The query
// code in src/app/sitemap.ts only loads data and calls this, so the "skip
// pending / sample" rule lives here where it is tested (sitemap.test.ts).
import type { ListingStatus } from "@prisma/client";
import { isPropertyPublic } from "./listings/rules";
import { absoluteUrl, languageAlternates, localePath, LOCALES } from "./seoCore";

/** Public pages with no per-record data. Compare pages are left out on purpose. */
export const STATIC_PATHS = [
  "/",
  "/market",
  "/calculators",
  "/calculators/mortgage",
  "/calculators/rental-yield",
  "/calculators/roi",
  "/calculators/affordability",
  "/properties",
  "/list-with-us",
  "/privacy",
  "/terms",
] as const;

/**
 * A sitemap file holds at most 50,000 addresses. Each property is listed in
 * two languages, so 20,000 properties = 40,000 addresses plus the pages above.
 * When the site outgrows this, switch to several sitemaps (generateSitemaps).
 */
export const MAX_SITEMAP_PROPERTIES = 20_000;

/**
 * The ONE rule for "this neighbourhood has a real (non-sample) market figure".
 * The sitemap lists only such neighbourhoods, and the neighbourhood page
 * asks search engines not to index the rest (sample figures only).
 */
export const neighborhoodHasRealFigureWhere = {
  marketStats: { some: { isSample: false } },
} as const;

/** Same rule on plain data: any non-sample figure. */
export function hasRealFigure(stats: { isSample: boolean }[]): boolean {
  return stats.some((s) => !s.isSample);
}

export type SitemapProperty = {
  id: string;
  isSample: boolean;
  updatedAt: Date;
  listings: { status: string; isSample: boolean; updatedAt: Date }[];
};

export type SitemapInput = {
  neighborhoodSlugs: string[];
  properties: SitemapProperty[];
};

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  alternates: { languages: Record<string, string> };
};

function entriesFor(base: string, path: string, lastModified?: Date): SitemapEntry[] {
  const languages = languageAlternates(base, path);
  return LOCALES.map((locale) => ({
    url: absoluteUrl(base, localePath(path, locale)),
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

/** Listed only with a live, non-sample listing and no sample flag, and passing the shared public rule. */
export function isSitemapProperty(p: SitemapProperty): boolean {
  if (p.isSample) return false;
  if (!isPropertyPublic(p.listings.map((l) => l.status as ListingStatus))) return false;
  return p.listings.some((l) => l.status === "ACTIVE" && !l.isSample);
}

export function buildSitemapEntries(
  input: SitemapInput,
  baseUrl: string,
  maxProperties: number = MAX_SITEMAP_PROPERTIES,
): SitemapEntry[] {
  const base = baseUrl.replace(/\/+$/, "");
  const out: SitemapEntry[] = [];
  for (const p of STATIC_PATHS) out.push(...entriesFor(base, p));
  for (const slug of input.neighborhoodSlugs) {
    out.push(...entriesFor(base, `/market/${encodeURIComponent(slug)}`));
  }
  const props = input.properties
    .filter(isSitemapProperty)
    .map((p) => {
      const times = [
        p.updatedAt,
        ...p.listings.filter((l) => l.status === "ACTIVE").map((l) => l.updatedAt),
      ];
      return { id: p.id, last: new Date(Math.max(...times.map((d) => d.getTime()))) };
    })
    .sort((a, b) => b.last.getTime() - a.last.getTime())
    .slice(0, maxProperties);
  for (const p of props) {
    out.push(...entriesFor(base, `/properties/${encodeURIComponent(p.id)}`, p.last));
  }
  return out;
}
