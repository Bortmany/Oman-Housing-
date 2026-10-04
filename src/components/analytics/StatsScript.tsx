import Script from "next/script";
import { parseStatsConfig, warnStatsProblemOnce } from "@/lib/stats";

// Visitor-stats script. Renders NOTHING unless both settings are valid (see
// src/lib/stats.ts), so the site ships without it by default. The tools this
// is meant for are cookieless: no cookie, no local storage, no consent banner.
export function StatsScript() {
  const cfg = parseStatsConfig(process.env);
  if (!cfg.configured) {
    warnStatsProblemOnce(cfg);
    return null;
  }
  const siteAttr = { [cfg.attr]: cfg.siteId };
  return <Script src={cfg.scriptUrl} strategy="afterInteractive" defer {...siteAttr} />;
}
