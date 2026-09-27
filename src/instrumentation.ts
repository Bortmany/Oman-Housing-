import * as Sentry from "@sentry/nextjs";

// Error tracking — DORMANT until SENTRY_DSN is set on the server.
// With no DSN, Sentry.init is never called, so the SDK stays completely inert
// (captureRequestError below simply no-ops when nothing is initialized).
// We do NOT wrap next.config with withSentryConfig — that build-time plugin is
// only needed for source-map upload; skipping it keeps the Next 16 build clean
// while still reporting server errors when a DSN is present.
export async function register() {
  // Node.js-only: stamps the true TCP socket address onto every request so
  // getClientIp() (src/lib/clientIp.ts) can key a cookie-less anonymous
  // caller (login, buyer enquiries) on a real per-source identity instead of
  // the shared "unknown" bucket. See instrumentation-node.ts for why this is
  // a dynamic import guarded by NEXT_RUNTIME rather than a top-level import
  // here (this file is also bundled for the Edge runtime).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { subscribeSocketIpDiagnostics } = await import("./instrumentation-node");
    await subscribeSocketIpDiagnostics();
  }

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
