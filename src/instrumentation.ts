import * as Sentry from "@sentry/nextjs";

// Error tracking — DORMANT until SENTRY_DSN is set on the server.
// With no DSN, Sentry.init is never called, so the SDK stays completely inert
// (captureRequestError below simply no-ops when nothing is initialized).
// We do NOT wrap next.config with withSentryConfig — that build-time plugin is
// only needed for source-map upload; skipping it keeps the Next 16 build clean
// while still reporting server errors when a DSN is present.
export async function register() {
  if (!process.env.SENTRY_DSN) return; // switched off until keyed

  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0, // errors only; turn on tracing deliberately later
    });
  }
}

// Reports server-side render/route errors to Sentry when it is configured;
// a harmless no-op otherwise.
export const onRequestError = Sentry.captureRequestError;
