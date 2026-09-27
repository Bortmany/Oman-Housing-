#!/usr/bin/env node
// Gives the tests their own database, separate from the development one.
//
//   node scripts/with-test-db.mjs                 -> create + migrate the test DB only
//   node scripts/with-test-db.mjs <command...>    -> same, then run <command> against it
//
// The test database is TEST_DATABASE_URL if set, otherwise DATABASE_URL with
// "_test" added to the database name (e.g. .../opip -> .../opip_test).
// It is brought up to date with `prisma migrate deploy` — the same committed
// migration files Railway applies. Never `db push`, never `migrate dev`.
// `migrate deploy` creates the database itself if it does not exist yet.
// While <command> runs, DATABASE_URL points at the test database, so no test
// can ever write to the development data.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function fail(message) {
  console.error(`\n[test database] ${message}\n`);
  process.exit(1);
}

// Pick up .env like Prisma and Next do (real environment variables win).
if (existsSync(".env")) process.loadEnvFile(".env");

function deriveTestUrl(devUrl) {
  let url;
  try {
    url = new URL(devUrl);
  } catch {
    fail("DATABASE_URL is not a valid connection address. See .env.example.");
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) fail("DATABASE_URL has no database name at the end. See .env.example.");
  url.pathname = `/${encodeURIComponent(`${name}_test`)}`;
  return url.toString();
}

const devUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL || (devUrl && deriveTestUrl(devUrl));

if (!testUrl) {
  fail(
    "No database address found. Set DATABASE_URL (or TEST_DATABASE_URL) in .env — " +
      "see .env.example and the verify recipe in docs/CONVENTIONS.md.",
  );
}
if (devUrl && testUrl === devUrl) {
  fail(
    "TEST_DATABASE_URL is the same as DATABASE_URL. The tests must use their own " +
      "database so they can never touch development data — pick a different name.",
  );
}

const testEnv = { ...process.env, DATABASE_URL: testUrl };
const shownName = new URL(testUrl).pathname.slice(1);

console.log(`[test database] Bringing "${shownName}" up to date (prisma migrate deploy)...`);
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: testEnv,
  stdio: "inherit",
});
if (migrate.status !== 0) {
  fail(
    `Could not prepare the test database "${shownName}". Is Postgres running? ` +
      "(check with: pg_isready)",
  );
}

const [command, ...args] = process.argv.slice(2);
if (!command) process.exit(0);

const run = spawnSync(command, args, { env: testEnv, stdio: "inherit" });
process.exit(run.status ?? 1);
