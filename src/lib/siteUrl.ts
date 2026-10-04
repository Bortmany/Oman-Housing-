// The ONE place the public web address is read. Used for metadataBase, the
// sitemap, robots, canonical + language links and share-image addresses.
// Pure parsing is split out (resolveSiteUrl) so it can be tested.

const DEV_FALLBACK = "http://localhost:3000";

/**
 * Turn the raw AUTH_URL setting into the site's base address with no trailing
 * slash. A missing or invalid value gives the localhost address OUTSIDE
 * production, and null in production — callers then skip anything that would
 * publish a wrong address (sitemap entries, canonical links, share images).
 */
export function resolveSiteUrl(
  authUrl: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  const raw = (authUrl ?? "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      // fall through to the fallback below
    }
  }
  return nodeEnv === "production" ? null : DEV_FALLBACK;
}

let warned = false;

/** The site's base address, or null in production when AUTH_URL is not set. */
export function getSiteUrl(): string | null {
  const base = resolveSiteUrl(process.env.AUTH_URL, process.env.NODE_ENV);
  if (base === null && !warned) {
    warned = true;
    console.warn(
      "AUTH_URL is not set to a valid web address: sitemap entries, canonical links and share images are skipped.",
    );
  }
  return base;
}
