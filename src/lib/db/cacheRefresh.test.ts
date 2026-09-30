// Cache-refresh guard. Run with: npm test
//
// The public market pages are cached for 5 minutes under MARKET_DATA_CACHE_TAG,
// and which figures/homes they show depends on market stats, properties AND
// live listings (a real live listing hides sample homes; a real figure hides
// the sample one). So EVERY server action that writes a MarketStat, Property
// or Listing must call updateTag(MARKET_DATA_CACHE_TAG), or the owner's change
// takes up to 5 minutes to show.
//
// Checklist this test enforces:
// 1. Every `actions.ts` under src/app: each action (`async function x` or
//    `const x = async (...) =>`) — or the local helper it delegates to — that
//    writes one of those tables also contains updateTag(MARKET_DATA_CACHE_TAG)
//    in real code (a mention inside a comment does not count).
// 2. Every src/lib/db/*.ts query module: a function that writes one of those
//    tables must be on DB_WRITE_ALLOW_LIST with a reason, and every caller of
//    an allow-listed function must live in an actions.ts (so check 1 covers
//    it). A new write helper therefore fails here until it is reviewed.
//
// Seam for Step 3: a background job route cannot call updateTag (server
// actions only). It must call revalidateTag(MARKET_DATA_CACHE_TAG, ...) from
// "next/cache" instead — add it to this test's scan when that route exists.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

let failures = 0;

const SRC = join(process.cwd(), "src");
const APP = join(SRC, "app");
const DB = join(SRC, "lib", "db");

const TABLE_WRITE =
  /\.(marketStat|property|listing)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;
const REFRESH = /updateTag\(MARKET_DATA_CACHE_TAG\)/;

/**
 * Query-module functions allowed to write market data, one line of reason
 * each. Their callers are checked below (they must be server actions).
 */
const DB_WRITE_ALLOW_LIST: Record<string, string> = {
  upsertMarketStat:
    "the one MarketStat write path (house rule 6); its callers are server actions checked in part 1",
};

function walk(dir: string, keep: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, keep));
    else if (keep(name)) out.push(full);
  }
  return out;
}

/** Blank out comments so a commented-out call never counts. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/**
 * Split a file into top-level function bodies, keyed by function name:
 * `async function x`, `function x`, and `const x = async (...) =>` /
 * `const x = async function`, each optionally exported.
 */
function functionsOf(source: string): Map<string, string> {
  const fns = new Map<string, string>();
  const re =
    /^(?:export\s+)?(?:(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*(?::[^=]+)?=\s*async\b)/gm;
  const starts: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) starts.push({ name: m[1] ?? m[2], index: m.index });
  starts.forEach((s, i) => {
    fns.set(s.name, source.slice(s.index, starts[i + 1]?.index ?? source.length));
  });
  return fns;
}

// ---- Self-check of the scanner itself --------------------------------------
{
  const sample = [
    "export const saveThing = async (fd: FormData) => {",
    "  await prisma.listing.update({});",
    "  // updateTag(MARKET_DATA_CACHE_TAG)",
    "};",
    "export async function other() {}",
  ].join("\n");
  const fns = functionsOf(stripComments(sample));
  const body = fns.get("saveThing") ?? "";
  if (!fns.has("other") || !TABLE_WRITE.test(body) || REFRESH.test(body)) {
    console.error("FAIL scanner self-check: arrow actions or comment stripping broken");
    failures++;
  } else {
    console.log("ok   scanner splits arrow actions and ignores commented-out refreshes");
  }
}

// ---- 1. Server actions refresh the cache -----------------------------------
const allowedCall = new RegExp(`\\b(${Object.keys(DB_WRITE_ALLOW_LIST).join("|")})\\(`);
const ACTION_WRITE = new RegExp(`${TABLE_WRITE.source}|${allowedCall.source}`);

let checked = 0;
for (const file of walk(APP, (n) => n === "actions.ts")) {
  const fns = functionsOf(stripComments(readFileSync(file, "utf8")));
  for (const [name, body] of fns) {
    if (!ACTION_WRITE.test(body)) continue;
    checked++;
    const label = `${relative(process.cwd(), file)} → ${name}()`;
    if (REFRESH.test(body)) {
      console.log(`ok   ${label} refreshes the market cache`);
    } else {
      console.error(`FAIL ${label} writes market data but never calls updateTag(MARKET_DATA_CACHE_TAG)`);
      failures++;
    }
  }
}

if (checked < 8) {
  // The known write paths: market-stats save/delete, properties save/delete,
  // review approve/reject/verify, listings save/setStatus/delete, agency submit.
  console.error(`FAIL expected to find at least 8 write paths, found ${checked} — has the scan broken?`);
  failures++;
}

// ---- 2. Query-module writes are reviewed -----------------------------------
const writersFound = new Set<string>();
for (const file of walk(DB, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
  const fns = functionsOf(stripComments(readFileSync(file, "utf8")));
  for (const [name, body] of fns) {
    if (!TABLE_WRITE.test(body)) continue;
    const label = `${relative(process.cwd(), file)} → ${name}()`;
    if (DB_WRITE_ALLOW_LIST[name]) {
      writersFound.add(name);
      console.log(`ok   ${label} writes market data (allowed: ${DB_WRITE_ALLOW_LIST[name]})`);
    } else {
      console.error(
        `FAIL ${label} writes market data outside a server action — add it to DB_WRITE_ALLOW_LIST with a reason, and make sure only server actions (which call updateTag) use it`,
      );
      failures++;
    }
  }
}
for (const name of Object.keys(DB_WRITE_ALLOW_LIST)) {
  if (!writersFound.has(name)) {
    console.error(`FAIL DB_WRITE_ALLOW_LIST names ${name}() but no query module writes through it — remove the stale entry`);
    failures++;
  }
}

// Every caller of an allow-listed writer must be a server action (covered by 1).
for (const file of walk(SRC, (n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n))) {
  if (file.startsWith(DB + "/")) continue; // the definitions themselves
  const source = stripComments(readFileSync(file, "utf8"));
  if (!allowedCall.test(source)) continue;
  const label = relative(process.cwd(), file);
  if (file.endsWith("/actions.ts")) {
    console.log(`ok   ${label} calls an allowed writer from a checked server action`);
  } else {
    console.error(`FAIL ${label} calls an allowed market-data writer outside a server action (actions.ts)`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} cache-refresh check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${checked} market-data write paths refresh the cache.`);
