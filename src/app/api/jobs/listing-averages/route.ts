import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { checkCronAuth } from "@/lib/cronAuth";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { runListingAveragesJob } from "@/lib/listingAveragesJob";

// Daily job: works out averages from live listings. Called by a scheduler
// (Railway cron, `0 23 * * *` = 03:00 Oman time) with
// `Authorization: Bearer <CRON_SECRET>`. POST only; no session is used.
// With CRON_SECRET unset or shorter than 16 characters it refuses everyone.

export const dynamic = "force-dynamic";

const RUN_LIMIT = { limit: 6, windowMs: 60 * 60 * 1000 };
const FAILED_AUTH_LIMIT = { limit: 20, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  const auth = checkCronAuth(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
  if (auth === "unavailable") {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  if (auth === "unauthorized") {
    // Wrong guesses are rate limited per IP before any database work.
    const guess = checkRateLimit(`job-auth:${getClientIp(request.headers)}`, FAILED_AUTH_LIMIT);
    if (!guess.allowed) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(guess.retryAfter) } },
      );
    }
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit("job:listing-averages", RUN_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    const result = await runListingAveragesJob();
    // updateTag only works inside server actions; a route uses revalidateTag.
    revalidateTag(MARKET_DATA_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("listing-averages.job.failed", err);
    Sentry.captureException(err, { tags: { job: "listing-averages" } });
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
