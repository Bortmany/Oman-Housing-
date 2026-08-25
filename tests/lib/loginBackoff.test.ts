// Login-lockout backoff math tests.
//
// Core guarantee under test: a WRONG guess past the limit gets an
// escalating-but-capped delay; it never produces a hard, sticky deny that
// could outlast a correct password's arrival. (The "correct password is
// always admitted" half of the guarantee lives in auth.ts itself — that
// branch returns before any of this code ever runs — and can't be unit
// tested here since auth.ts pulls in next-auth/Prisma.)
import { describe, expect, test } from "vitest";
import { computeLoginBackoffMs, computeOvershoot } from "@/lib/loginBackoff";

describe("computeOvershoot", () => {
  test("under both limits: no overshoot", () => {
    expect(computeOvershoot({ count: 5, limit: 20 }, { count: 3, limit: 10 })).toBe(0);
  });

  test('exactly at the limit: still the "first denial", overshoot 0', () => {
    expect(computeOvershoot({ count: 5, limit: 20 }, { count: 11, limit: 10 })).toBe(0);
  });

  test("one further wrong guess: overshoot 1", () => {
    expect(computeOvershoot({ count: 5, limit: 20 }, { count: 12, limit: 10 })).toBe(1);
  });

  test("whichever bucket (IP or email) is further over wins", () => {
    expect(computeOvershoot({ count: 25, limit: 20 }, { count: 11, limit: 10 })).toBe(4);
  });

  test("never negative", () => {
    expect(computeOvershoot({ count: 0, limit: 20 }, { count: 0, limit: 10 })).toBe(0);
  });
});

describe("computeLoginBackoffMs", () => {
  const BASE = 1500;
  const MAX = 30_000;

  test("first denial: the base delay", () => {
    expect(computeLoginBackoffMs(0, BASE, MAX)).toBe(1500);
  });

  test("doubles per guess past the first", () => {
    expect(computeLoginBackoffMs(1, BASE, MAX)).toBe(3000);
    expect(computeLoginBackoffMs(2, BASE, MAX)).toBe(6000);
    expect(computeLoginBackoffMs(3, BASE, MAX)).toBe(12_000);
  });

  test("caps at the ceiling instead of growing unbounded", () => {
    // A real request must never hang forever, even under a sustained flood
    // of wrong guesses.
    expect(computeLoginBackoffMs(10, BASE, MAX)).toBe(MAX);
    expect(computeLoginBackoffMs(50, BASE, MAX)).toBe(MAX);
  });
});
