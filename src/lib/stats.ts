// Visitor-stats settings (privacy-friendly counter, off by default).
//
// Pure and dependency-free so next.config.ts (which builds the security
// policy) and the layout (which adds the script tag) read the SAME rules.
// Works for Plausible, Umami or GoatCounter by settings only:
//   NEXT_PUBLIC_STATS_SCRIPT_URL  full https:// address of the tool's script
//   NEXT_PUBLIC_STATS_SITE_ID     Plausible: the domain; Umami: the website id;
//                                 GoatCounter: the full counting address
//   NEXT_PUBLIC_STATS_ATTR        optional attribute name the script reads the
//                                 site id from (default data-website-id;
//                                 Plausible: data-domain)
// "Configured" = valid https:// script address AND a non-empty site id.
// Anything else is "not configured" — never a crash.

export type StatsConfig = {
  configured: boolean;
  scriptUrl: string;
  siteId: string;
  attr: string;
  /** Hosts the browser must be allowed to reach (script first, then any counting host). */
  origins: string[];
  /** Why a partly-set value was ignored (for one server log line), if so. */
  problem?: string;
};

export const DEFAULT_STATS_ATTR = "data-website-id";

const OFF: StatsConfig = {
  configured: false,
  scriptUrl: "",
  siteId: "",
  attr: DEFAULT_STATS_ATTR,
  origins: [],
};

/** "https://host:port" for a valid https address, otherwise null. */
function httpsOrigin(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname ? u.origin : null;
  } catch {
    return null;
  }
}

export function parseStatsConfig(
  env: Record<string, string | undefined>,
): StatsConfig {
  const rawUrl = (env.NEXT_PUBLIC_STATS_SCRIPT_URL ?? "").trim();
  const siteId = (env.NEXT_PUBLIC_STATS_SITE_ID ?? "").trim();
  if (!rawUrl && !siteId) return OFF;

  const scriptOrigin = rawUrl ? httpsOrigin(rawUrl) : null;
  if (!scriptOrigin) {
    return { ...OFF, problem: "stats script address is missing or not an https:// address" };
  }
  if (!siteId) {
    return { ...OFF, problem: "stats site id is missing" };
  }

  const rawAttr = (env.NEXT_PUBLIC_STATS_ATTR ?? "").trim().toLowerCase();
  // Only a plain data-* attribute name is accepted; anything else falls back.
  const attr = /^data-[a-z0-9-]{1,40}$/.test(rawAttr) ? rawAttr : DEFAULT_STATS_ATTR;

  const origins = [scriptOrigin];
  // GoatCounter-style: the site id is itself an address the browser calls.
  const idOrigin = httpsOrigin(siteId);
  if (idOrigin && !origins.includes(idOrigin)) origins.push(idOrigin);

  return { configured: true, scriptUrl: new URL(rawUrl).href, siteId, attr, origins };
}

export function isStatsConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return parseStatsConfig(env).configured;
}

let warned = false;

/** One server-side log line when a value was set but ignored; never throws. */
export function warnStatsProblemOnce(cfg: StatsConfig): void {
  if (!cfg.problem || warned) return;
  warned = true;
  console.warn(`[stats] ignored: ${cfg.problem}`);
}
