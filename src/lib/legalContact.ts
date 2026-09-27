// ---------------------------------------------------------------------------
// Legal contact address — the email shown on the Privacy Policy and Terms of
// Use pages ("for questions about this page or your information: ...").
//
//   PRIVACY_CONTACT_EMAIL   optional; overrides the address. When unset,
//                           blank, or not a plausible email address, the
//                           owner's own address is used (see .env.example).
//
// Read server-side only (both legal pages are server components) and passed
// into the translations as the {contactEmail} value, so the address never
// lives inside messages/*.json. Pure function, no "server-only" import, so
// `npm test` can run legalContact.test.ts under tsx.
// ---------------------------------------------------------------------------

/** The owner's address — used whenever PRIVACY_CONTACT_EMAIL is not set. */
export const DEFAULT_PRIVACY_CONTACT_EMAIL = "naeljam@hotmail.com";

export type LegalContactEnv = {
  PRIVACY_CONTACT_EMAIL?: string;
};

/**
 * Loose "looks like an email" check: one @, something on both sides, no
 * spaces. Anything failing it falls back to the default rather than
 * rendering a broken mailto link on a legal page.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function resolvePrivacyContactEmail(env: LegalContactEnv): string {
  const raw = env.PRIVACY_CONTACT_EMAIL?.trim() ?? "";
  return raw && looksLikeEmail(raw) ? raw : DEFAULT_PRIVACY_CONTACT_EMAIL;
}

/** The live address, read from the process environment. */
export function getPrivacyContactEmail(): string {
  return resolvePrivacyContactEmail({
    PRIVACY_CONTACT_EMAIL: process.env.PRIVACY_CONTACT_EMAIL,
  });
}
