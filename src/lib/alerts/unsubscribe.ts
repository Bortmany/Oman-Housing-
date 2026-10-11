// One-click unsubscribe links for alert emails. Pure (only node:crypto).
//
// The link carries the saved-search id and a signature: HMAC-SHA256 over a
// fixed label plus the id, keyed with AUTH_SECRET. Whoever holds the link can
// switch off THAT search's alerts and nothing else; nobody can make a link for
// someone else's search without the secret. No expiry: an unsubscribe link in
// an old email must keep working.

import { createHmac, timingSafeEqual } from "node:crypto";

const LABEL = "alert-unsubscribe:v1:";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** Hex signature for one saved search. */
export function signUnsubscribe(savedSearchId: string, key: string = secret()): string {
  return createHmac("sha256", key).update(LABEL + savedSearchId).digest("hex");
}

/** Constant-time check. Never throws; any odd input is simply "no". */
export function verifyUnsubscribe(
  savedSearchId: string,
  signature: string,
  key?: string,
): boolean {
  try {
    if (!savedSearchId || !/^[0-9a-f]{64}$/.test(signature)) return false;
    const expected = Buffer.from(signUnsubscribe(savedSearchId, key), "hex");
    const given = Buffer.from(signature, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

/** The public address in the email, e.g. https://site/api/alerts/unsubscribe?... */
export function buildUnsubscribeUrl(
  baseUrl: string,
  savedSearchId: string,
  locale: "en" | "ar",
): string {
  const params = new URLSearchParams({
    s: savedSearchId,
    t: signUnsubscribe(savedSearchId),
    lang: locale,
  });
  return `${baseUrl.replace(/\/+$/, "")}/api/alerts/unsubscribe?${params.toString()}`;
}

/** The two headers mail apps use for their own "Unsubscribe" button. */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
