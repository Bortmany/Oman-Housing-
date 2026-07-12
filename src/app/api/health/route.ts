import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Health endpoint for uptime checks (ops-watchdog / Railway).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
