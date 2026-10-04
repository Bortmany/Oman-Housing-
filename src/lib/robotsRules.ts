// Robots rules. Every real address starts with /en or /ar, so each private
// area is blocked under both prefixes. /api is blocked EXCEPT /api/images/,
// because listing photos are served from there and share-preview scrapers and
// Google Images must be able to fetch them (the more specific Allow wins).
// robots.txt is a request, not security: the real protection is the login
// gate in src/proxy.ts.
import { LOCALES } from "./seoCore";

const PRIVATE_AREAS = ["admin", "agency", "account", "login", "register", "favorites"];

export const ROBOTS_DISALLOW: string[] = [
  ...LOCALES.flatMap((l) => PRIVATE_AREAS.map((a) => `/${l}/${a}`)),
  "/api/",
];

export const ROBOTS_ALLOW: string[] = ["/", "/api/images/"];

export function buildRobots(base: string | null) {
  return {
    rules: { userAgent: "*", allow: ROBOTS_ALLOW, disallow: ROBOTS_DISALLOW },
    // No Sitemap line when the base address is unknown (never publish localhost).
    ...(base ? { sitemap: `${base.replace(/\/+$/, "")}/sitemap.xml` } : {}),
  };
}
