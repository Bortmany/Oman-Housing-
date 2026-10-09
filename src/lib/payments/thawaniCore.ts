// Thawani Pay — the pure half (addresses, reading the gateway's answer).
// No network and no secrets in here, so it is tested directly in
// payments.test.ts. The part that talks to Thawani is thawani.ts.

export type ThawaniEnv = "sandbox" | "production";

const SANDBOX_BASE_URL = "https://uatcheckout.thawani.om/api/v1";
const PRODUCTION_BASE_URL = "https://checkout.thawani.om/api/v1";

export function baseUrlFor(env: ThawaniEnv): string {
  return env === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

/** Anything but the exact word "production" is the sandbox: test money, never real. */
export function parseThawaniEnv(raw: string | undefined): ThawaniEnv {
  return raw?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

/**
 * The shopper's payment page lives on the checkout host WITHOUT /api/v1:
 * https://uatcheckout.thawani.om/pay/<session>?key=<publishable>
 */
export function payPageUrl(env: ThawaniEnv, sessionId: string, publishableKey: string): string {
  return `${baseUrlFor(env).replace("/api/v1", "")}/pay/${encodeURIComponent(sessionId)}?key=${encodeURIComponent(publishableKey)}`;
}

/** What we read out of Thawani's "look up this session" answer. */
export type SessionAnswer = {
  /** The exact payment_status text, or null when absent. */
  status: string | null;
  /** The session's total in baisa, or null when absent or not a whole number. */
  amountBaisa: number | null;
  /** The client_reference_id we sent (our payment id), or null. */
  reference: string | null;
  /** Currency, upper case, or null when the answer does not say. */
  currency: string | null;
  /** The answer, with anything card- or person-like removed, ready to store. */
  payload: Record<string, unknown>;
};

const DROP_KEYS = /card|pan\b|cvv|cvc|expiry|email|phone|mobile|address/i;
const MAX_PAYLOAD_CHARS = 20_000;

function scrub(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth > 6) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (DROP_KEYS.test(k)) continue;
    out[k] = scrub(v, depth + 1);
  }
  return out;
}

/** Thawani amounts are WHOLE baisa; "3000" is fine, "3.5" is not. */
function wholeBaisa(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw === "string" && /^\d{1,12}$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

/**
 * Read a lookup answer. Thawani wraps it as { success, code, data: {...} }.
 * Only the exact value "paid" ever counts as paid (the caller checks).
 */
export function parseSessionAnswer(json: unknown): SessionAnswer | null {
  if (json === null || typeof json !== "object") return null;
  const data = (json as { data?: unknown }).data;
  if (data === null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const status = typeof d.payment_status === "string" ? d.payment_status : null;
  const amountBaisa = wholeBaisa(d.total_amount);
  const reference = typeof d.client_reference_id === "string" ? d.client_reference_id : null;
  const currency = typeof d.currency === "string" ? d.currency.toUpperCase() : null;

  let payload = scrub(d) as Record<string, unknown>;
  if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) {
    payload = { truncated: true, payment_status: status, total_amount: amountBaisa };
  }
  return { status, amountBaisa, reference, currency, payload };
}
