// The secret check for scheduled-job routes (Align Step 3, Build C). Pure — no
// request objects — so it is tested directly in cronAuth.test.ts.
//
// Safe default: if CRON_SECRET is missing or shorter than 16 characters the
// answer is always "unavailable" (503), so a job route can never run open.
// The token is compared in constant time (both sides hashed to the same
// length first, so neither content nor length leaks through timing).

import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_CRON_SECRET_LENGTH = 16;

export type CronAuthResult = "ok" | "unavailable" | "unauthorized";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export function checkCronAuth(
  authorizationHeader: string | null | undefined,
  secret: string | undefined,
): CronAuthResult {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return "unavailable";
  const match = /^Bearer (.+)$/.exec(authorizationHeader ?? "");
  if (!match) return "unauthorized";
  return timingSafeEqual(sha256(match[1]), sha256(secret)) ? "ok" : "unauthorized";
}
