// Pure helpers for search-engine and share-preview tags. No I/O, no Prisma
// client: tested in seoCore.test.ts (runs in `npm test`).
import type { Metadata } from "next";
import { formatOMRWhole } from "./money";

export const LOCALES = ["en", "ar"] as const;

/** Path under a language prefix: ("/market", "ar") -> "/ar/market"; home -> "/ar". */
export function localePath(path: string, locale: string): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

export function absoluteUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

/** Same page in both languages; x-default is the English page of that path. */
export function languageAlternates(base: string, path: string) {
  return {
    en: absoluteUrl(base, localePath(path, "en")),
    ar: absoluteUrl(base, localePath(path, "ar")),
    "x-default": absoluteUrl(base, localePath(path, "en")),
  };
}

export function ogLocale(locale: string): { locale: string; alternateLocale: string } {
  return locale === "ar"
    ? { locale: "ar_OM", alternateLocale: "en_US" }
    : { locale: "en_US", alternateLocale: "ar_OM" };
}

export const DEFAULT_SHARE_IMAGE = {
  path: "/og-default.jpg",
  width: 1200,
  height: 630,
};

export type ShareImage = { url: string; alt: string; width?: number; height?: number };

export function defaultShareImage(base: string, alt: string): ShareImage {
  return {
    url: absoluteUrl(base, DEFAULT_SHARE_IMAGE.path),
    alt,
    width: DEFAULT_SHARE_IMAGE.width,
    height: DEFAULT_SHARE_IMAGE.height,
  };
}

export type PageMetaInput = {
  base: string | null;
  locale: string;
  /** Path without the language prefix, no query string. "/" is the home page. */
  path: string;
  /** Page title; leave out for the home page (site name only). */
  title?: string;
  description: string;
  siteName: string;
  /** Share image (absolute address). Left out when the base is unknown. */
  image?: ShareImage;
  noindex?: boolean;
  /** Keep links followable when noindex is set (properties). */
  follow?: boolean;
};

/**
 * Full head tags for a public page: canonical + language links, Open Graph and
 * Twitter. Each language is its own canonical and the pair is linked through
 * `languages`. The canonical never carries a query string. With no known base
 * address (production, AUTH_URL unset) address-bearing tags are skipped.
 */
export function buildPageMetadata(i: PageMetaInput): Metadata {
  const fullTitle = i.title ? `${i.title} · ${i.siteName}` : i.siteName;
  const canonical = i.base ? absoluteUrl(i.base, localePath(i.path, i.locale)) : undefined;
  const images = i.base && i.image ? [i.image] : undefined;
  const meta: Metadata = {
    ...(i.title ? { title: i.title } : {}),
    description: i.description,
    ...(i.base && canonical
      ? { alternates: { canonical, languages: languageAlternates(i.base, i.path) } }
      : {}),
    openGraph: {
      type: "website",
      siteName: i.siteName,
      title: fullTitle,
      description: i.description,
      ...(canonical ? { url: canonical } : {}),
      ...ogLocale(i.locale),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: i.description,
      ...(images ? { images } : {}),
    },
  };
  if (i.noindex) meta.robots = { index: false, follow: i.follow ?? false };
  return meta;
}

// ---------- Property share text ----------

export type ShareListing = {
  status: string;
  listingType: "SALE" | "RENT";
  price: number | string;
  rentPeriod?: "MONTHLY" | "ANNUAL" | null;
  isSample?: boolean;
};

export type ShareTextInput = {
  locale: string;
  templates: { sale: string; rent: string; noPrice: string };
  periodLabels: { MONTHLY: string; ANNUAL: string };
  type: string;
  area: string;
  city: string;
  propertyIsSample: boolean;
  /** Newest first. Only a live, non-sample listing can supply a price. */
  listings: ShareListing[];
};

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** The listing whose asking price may appear in a share preview, if any. */
export function priceableListing(
  listings: ShareListing[],
  propertyIsSample: boolean,
): ShareListing | null {
  if (propertyIsSample) return null;
  return listings.find((l) => l.status === "ACTIVE" && !l.isSample) ?? null;
}

/**
 * The share-preview description. The ONLY figure it can carry is the ASKING
 * price of a live (ACTIVE), non-sample listing, formatted with formatOMRWhole.
 * No live listing, or a sample record: no price at all. Never an estimate,
 * yield or fair value (data honesty).
 */
export function buildPropertyShareText(i: ShareTextInput): string {
  const base = { type: i.type, area: i.area, city: i.city };
  const l = priceableListing(i.listings, i.propertyIsSample);
  const n = l ? Number(l.price) : NaN;
  if (!l || !Number.isFinite(n)) return fill(i.templates.noPrice, base);
  const price = formatOMRWhole(n, i.locale);
  if (l.listingType === "RENT") {
    return fill(i.templates.rent, {
      ...base,
      price,
      period: i.periodLabels[l.rentPeriod ?? "MONTHLY"],
    });
  }
  return fill(i.templates.sale, { ...base, price });
}

/** Search engines may index a property only with a live listing and no sample flag. */
export function isPropertyIndexable(p: {
  isSample: boolean;
  listings: { status: string; isSample?: boolean }[];
}): boolean {
  return !p.isSample && p.listings.some((l) => l.status === "ACTIVE" && !l.isSample);
}

/** The cover photo: the one marked primary, else the first by sort order. */
export function pickCoverImage<T extends { isPrimary: boolean; sortOrder: number }>(
  images: T[],
): T | null {
  if (images.length === 0) return null;
  return (
    [...images].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
    )[0] ?? null
  );
}

/** First ~160 characters of a free-text description, cut at a word, or "" when empty. */
export function shortDescription(text: string | null | undefined, max = 160): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}
