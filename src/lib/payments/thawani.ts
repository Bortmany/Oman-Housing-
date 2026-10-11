import "server-only";

// Thawani Pay (Oman's local card gateway) for featured-listing payments.
// Mirrors Dukkani's integration (hosted checkout page; we ask Thawani whether
// a session was really paid before trusting anything), with one difference:
// the keys are the PLATFORM's own (money goes to this site's merchant
// account), and nothing here runs until both keys are set.
//
// DORMANT until THAWANI_API_KEY (secret) AND THAWANI_PUBLISHABLE_KEY are set.
// THAWANI_ENV=sandbox (default, test money) or production. Without keys no
// call is ever made: the site says "online payments aren't switched on yet".
//
// The secret key is read here only, sent only to Thawani as a header, and is
// never logged, returned or put in a page. Errors are reported without detail
// (a network error object can carry request headers).

import {
  baseUrlFor,
  parseSessionAnswer,
  parseThawaniEnv,
  payPageUrl,
  type SessionAnswer,
  type ThawaniEnv,
} from "./thawaniCore";

const REQUEST_TIMEOUT_MS = 15_000;

type Config = { secretKey: string; publishableKey: string; env: ThawaniEnv };

function config(): Config | null {
  const secretKey = process.env.THAWANI_API_KEY?.trim() ?? "";
  const publishableKey = process.env.THAWANI_PUBLISHABLE_KEY?.trim() ?? "";
  if (!secretKey || !publishableKey) return null;
  return { secretKey, publishableKey, env: parseThawaniEnv(process.env.THAWANI_ENV) };
}

/** True only when BOTH keys are set. */
export function isThawaniEnabled(): boolean {
  return config() !== null;
}

/** The page to send the payer to for an existing session (null when dormant). */
export function payUrlFor(sessionId: string): string | null {
  const c = config();
  return c ? payPageUrl(c.env, sessionId, c.publishableKey) : null;
}

export type CreateSessionInput = {
  paymentId: string;
  amountBaisa: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
};

/** Create a hosted-checkout session. Never throws: null = could not. */
export async function createCheckoutSession(
  input: CreateSessionInput,
): Promise<{ sessionId: string } | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(`${baseUrlFor(c.env)}/checkout/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "thawani-api-key": c.secretKey },
      body: JSON.stringify({
        client_reference_id: input.paymentId,
        mode: "payment",
        products: [
          { name: input.productName.slice(0, 40), quantity: 1, unit_amount: input.amountBaisa },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { paymentId: input.paymentId },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sessionId: unknown = data?.data?.session_id;
    return typeof sessionId === "string" && sessionId ? { sessionId } : null;
  } catch {
    return null;
  }
}

/** Ask Thawani about a session (server to server). null = the lookup failed. */
export async function lookupSession(sessionId: string): Promise<SessionAnswer | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(
      `${baseUrlFor(c.env)}/checkout/session/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: { "thawani-api-key": c.secretKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    return parseSessionAnswer(await res.json());
  } catch {
    return null;
  }
}
