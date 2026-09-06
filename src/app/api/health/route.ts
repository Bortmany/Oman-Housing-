import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isCaptchaConfigured } from "@/lib/captcha";
import { getSignupMode } from "@/lib/signupMode";

// Health endpoint for uptime checks (ops-watchdog / Railway).
//
// Anonymous callers (uptime pings, and anyone on the internet) get only the
// minimal ok/db status they need. The integrations breakdown — which optional
// services are switched on — is config detail that helps nobody but an
// attacker fingerprinting the deployment, so it is shown ONLY to a signed-in
// admin, who can still confirm at a glance what is live in production.
export async function GET() {
  const session = await auth().catch(() => null);
  const isAdmin = session?.user?.role === "ADMIN";

  const integrations = isAdmin
    ? {
        sentry: process.env.SENTRY_DSN ? "configured" : "dormant",
        aiAnalyst: process.env.ANTHROPIC_API_KEY ? "configured" : "dormant",
        rateLimitStore: process.env.REDIS_URL ? "redis" : "in-memory",
        captcha: isCaptchaConfigured() ? "configured" : "dormant",
        // "open" | "invite" | "closed" — see src/lib/signupMode.ts. Admin-only
        // like the rest: the codes themselves are never shown anywhere.
        signups: getSignupMode(),
      }
    : undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", ...(integrations && { integrations }) });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", ...(integrations && { integrations }) },
      { status: 503 },
    );
  }
}
