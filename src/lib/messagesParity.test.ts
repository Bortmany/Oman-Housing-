// English and Arabic message files must carry exactly the same keys (house
// rule 3: no "translate later"), and no string may be empty.
// Run with: npm test
import { readFileSync } from "node:fs";
import path from "node:path";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    console.error(`FAIL ${label} ${detail}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

function leaves(obj: unknown, prefix = ""): Array<[string, unknown]> {
  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [[prefix, obj]];
}

const dir = path.resolve(__dirname, "..", "..", "messages");
const en = leaves(JSON.parse(readFileSync(path.join(dir, "en.json"), "utf8")));
const ar = leaves(JSON.parse(readFileSync(path.join(dir, "ar.json"), "utf8")));
const enKeys = new Set(en.map(([k]) => k));
const arKeys = new Set(ar.map(([k]) => k));

const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
check("every English key exists in Arabic", missingInAr.length === 0, JSON.stringify(missingInAr.slice(0, 10)));
check("every Arabic key exists in English", missingInEn.length === 0, JSON.stringify(missingInEn.slice(0, 10)));
const empty = [...en, ...ar].filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => k);
check("no empty strings", empty.length === 0, JSON.stringify(empty.slice(0, 10)));

// The legal pages' new blocks exist in both languages.
for (const k of ["legal.privacy.collectAds", "legal.privacy.collectPayments", "legal.terms.adsTitle", "legal.terms.adsBody"]) {
  check(`${k} present in both`, enKeys.has(k) && arKeys.has(k));
}
// The old blanket claim must not come back.
const enText = en.find(([k]) => k === "legal.privacy.collectTechnical")?.[1] as string;
check("privacy: cookie sentence mentions no ad network", /no advertising network/.test(enText));

if (failures > 0) {
  console.error(`\n${failures} messages parity test(s) failed`);
  process.exit(1);
}
console.log("\nAll messages parity tests passed.");
