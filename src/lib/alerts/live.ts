// "Are alert emails really going out?" — one answer for the account page, the
// save-search note and /api/health. Pure: no I/O.
//
// Alerts need BOTH an email service (live or the local outbox) AND a valid
// CRON_SECRET (16+ characters), because the hourly job that sends them refuses
// to run without it (see cronAuth.ts). Email alone is not enough.

import { MIN_CRON_SECRET_LENGTH } from "../cronAuth";

export function isCronSecretValid(secret: string | undefined | null): boolean {
  return (secret?.length ?? 0) >= MIN_CRON_SECRET_LENGTH;
}

export function alertsAreLive(
  mode: "live" | "outbox" | "off",
  cronSecret: string | undefined | null,
): boolean {
  return mode !== "off" && isCronSecretValid(cronSecret);
}
