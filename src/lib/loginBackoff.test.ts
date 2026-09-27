// Login-lockout backoff math tests. Run with: npm test
//
// Core guarantee under test: a WRONG guess past the limit gets an
// escalating-but-capped delay; it never produces a hard, sticky deny that
// could outlast a correct password's arrival. (The "correct password is
// always admitted" half of the guarantee lives in auth.ts itself — that
// branch returns before any of this code ever runs — and can't be unit
// tested here since auth.ts pulls in next-auth/Prisma.)
import { computeLoginBackoffMs, computeOvershoot } from "./loginBackoff";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

// --- computeOvershoot ---

// Under both limits: no overshoot.
expectEqual(
  "overshoot.underLimits",
  computeOvershoot({ count: 5, limit: 20 }, { count: 3, limit: 10 }),
  0,
);

// Exactly at the limit: still the "first denial", overshoot 0.
expectEqual(
  "overshoot.firstDenial.byEmail",
  computeOvershoot({ count: 5, limit: 20 }, { count: 11, limit: 10 }),
  0,
);

// One further wrong guess: overshoot 1.
expectEqual(
  "overshoot.secondDenial.byEmail",
  computeOvershoot({ count: 5, limit: 20 }, { count: 12, limit: 10 }),
  1,
);

// Whichever bucket (IP or email) is further over wins.
expectEqual(
  "overshoot.takesWorseBucket",
  computeOvershoot({ count: 25, limit: 20 }, { count: 11, limit: 10 }),
  4,
);

// Never negative.
expectEqual(
  "overshoot.neverNegative",
  computeOvershoot({ count: 0, limit: 20 }, { count: 0, limit: 10 }),
  0,
);

// --- computeLoginBackoffMs ---

const BASE = 1500;
const MAX = 30_000;

// First denial: the base delay.
expectEqual("backoff.firstDenial", computeLoginBackoffMs(0, BASE, MAX), 1500);

// Doubles per guess past the first.
expectEqual("backoff.doubles.1", computeLoginBackoffMs(1, BASE, MAX), 3000);
expectEqual("backoff.doubles.2", computeLoginBackoffMs(2, BASE, MAX), 6000);
expectEqual("backoff.doubles.3", computeLoginBackoffMs(3, BASE, MAX), 12_000);

// Caps at the ceiling instead of growing unbounded — a real request must
// never hang forever, even under a sustained flood of wrong guesses.
expectEqual("backoff.capsAtMax.large", computeLoginBackoffMs(10, BASE, MAX), MAX);
expectEqual("backoff.capsAtMax.huge", computeLoginBackoffMs(50, BASE, MAX), MAX);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll login-backoff tests passed.");
