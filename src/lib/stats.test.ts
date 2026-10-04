// Visitor-stats settings tests. Run with: npm test
import { parseStatsConfig, DEFAULT_STATS_ATTR } from "./stats";

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL ${label}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const U = "NEXT_PUBLIC_STATS_SCRIPT_URL";
const I = "NEXT_PUBLIC_STATS_SITE_ID";
const A = "NEXT_PUBLIC_STATS_ATTR";

const none = parseStatsConfig({});
check("unset -> not configured, no origins, no problem", !none.configured && none.origins.length === 0 && !none.problem);
check("blank strings -> not configured", !parseStatsConfig({ [U]: "  ", [I]: "" }).configured);

const http = parseStatsConfig({ [U]: "http://stats.example.com/s.js", [I]: "abc" });
check("http script rejected", !http.configured && http.origins.length === 0 && !!http.problem);

const noId = parseStatsConfig({ [U]: "https://stats.example.com/s.js" });
check("missing site id rejected", !noId.configured && noId.origins.length === 0);

const noUrl = parseStatsConfig({ [I]: "abc" });
check("missing script address rejected", !noUrl.configured);

const umami = parseStatsConfig({ [U]: "https://cloud.umami.is/script.js", [I]: "1234-abcd" });
check("Umami-style configured", umami.configured && umami.siteId === "1234-abcd");
check("script origin derived", umami.origins.length === 1 && umami.origins[0] === "https://cloud.umami.is");
check("attribute defaults to data-website-id", umami.attr === "data-website-id" && DEFAULT_STATS_ATTR === "data-website-id");

const plausible = parseStatsConfig({
  [U]: "https://plausible.io/js/script.js",
  [I]: "oman-property.example",
  [A]: "data-domain",
});
check("Plausible-style configured with data-domain", plausible.configured && plausible.attr === "data-domain");
check("Plausible domain adds no extra origin", plausible.origins.length === 1 && plausible.origins[0] === "https://plausible.io");

const goat = parseStatsConfig({
  [U]: "https://gc.zgo.at/count.js",
  [I]: "https://name.goatcounter.com/count",
  [A]: "data-goatcounter",
});
check(
  "GoatCounter site id adds its own origin",
  goat.configured && goat.origins.join(",") === "https://gc.zgo.at,https://name.goatcounter.com",
);

const bad = parseStatsConfig({ [U]: "https://x.example/s.js", [I]: "id", [A]: 'onload="x"' });
check("unsafe attribute name falls back to default", bad.configured && bad.attr === DEFAULT_STATS_ATTR);

for (const junk of ["not a url", "javascript:alert(1)", "https://", "//x.com/a.js", "\u0000", "https://[::1"]) {
  let ok = true;
  try {
    const r = parseStatsConfig({ [U]: junk, [I]: junk, [A]: junk });
    ok = typeof r.configured === "boolean" && (!r.configured || r.origins.every((o) => o.startsWith("https://")));
  } catch {
    ok = false;
  }
  check(`junk does not throw: ${JSON.stringify(junk)}`, ok);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll stats tests passed.");
