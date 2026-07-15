import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Health endpoint for uptime checks (ops-watchdog / Railway).
// Also reports which optional integrations are switched on (their env var set)
// vs. dormant — the owner can confirm at a glance what is live in production.
export async function GET() {
  const integrations = {
    sentry: process.env.SENTRY_DSN ? "configured" : "dormant",
    aiAnalyst: process.env.ANTHROPIC_API_KEY ? "configured" : "dormant",
    rateLimitStore: process.env.REDIS_URL ? "redis" : "in-memory",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", integrations });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", integrations },
      { status: 503 },
    );
  }
}
