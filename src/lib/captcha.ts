import "server-only";

// Cloudflare Turnstile — a free CAPTCHA on the login, register and
// list-with-us forms. DORMANT until BOTH keys are set (see .env.example):
// with either one missing, isCaptchaConfigured() is false, the forms render
// no widget, and verifyCaptcha() lets every submission through. Once both
// are set, every one of those submissions must carry a fresh widget token
// that Cloudflare confirms server-side.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The hidden form field the Turnstile widget fills in. */
export const CAPTCHA_FIELD = "cf-turnstile-response";

// --- One-time "already checked" passes for server-initiated sign-ins ------
//
// Register and list-with-us verify the visitor's CAPTCHA token themselves,
// then sign the new account in through the same Credentials provider the
// login form uses. That provider re-checks the CAPTCHA — and a Turnstile
// token is single use, so a second check would fail. Instead the action
// mints a random, unguessable, single-use pass that authorize() accepts in
// place of a token. Passes live in memory for 60s (per server process, like
// the in-memory rate limiter) and cannot be produced by a visitor.

const PASS_TTL_MS = 60 * 1000;
const passes = new Map<string, number>(); // pass → expiry (epoch ms)

/** Mint a pass — only after verifyCaptcha() returned true. */
export function issueCaptchaPass(): string {
  const now = Date.now();
  for (const [key, exp] of passes) if (exp <= now) passes.delete(key);
  const pass = crypto.randomUUID() + crypto.randomUUID();
  passes.set(pass, now + PASS_TTL_MS);
  return pass;
}

/** True exactly once per valid, unexpired pass. */
export function consumeCaptchaPass(pass: unknown): boolean {
  if (typeof pass !== "string" || pass.length === 0) return false;
  const exp = passes.get(pass);
  passes.delete(pass);
  return exp !== undefined && exp > Date.now();
}

export function isCaptchaConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

/**
 * True when the submission may proceed. Always true while dormant. When
 * configured, asks Cloudflare whether `token` is a genuine, unused widget
 * response; a missing token, a network failure or a Cloudflare "no" all
 * count as a fail (the visitor just retries — the widget resets itself).
 */
export async function verifyCaptcha(token: unknown): Promise<boolean> {
  if (!isCaptchaConfigured()) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return false;
  }
  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY as string,
      response: token,
    });
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Never log the token or secret; a failed check just blocks this attempt.
    console.warn("[captcha] Turnstile verification request failed");
    return false;
  }
}
