"use server";

import { revalidatePath, updateTag } from "next/cache";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { requireAdmin } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { runListingAveragesJob } from "@/lib/listingAveragesJob";

// "Recompute now" on /admin/market-stats (Align Step 3, Build C): runs the
// same job as the daily schedule. Admin only (checked here, rule 7), six runs
// per hour per admin.

const RUN_LIMIT = { limit: 6, windowMs: 60 * 60 * 1000 };

export type RecomputeState =
  | { kind: "done"; written: number; kept: number; removed: number }
  | { kind: "rateLimited"; minutes: number }
  | { kind: "error" }
  | { kind: "notAllowed" }
  | null;

export async function recomputeListingAverages(): Promise<RecomputeState> {
  const session = await requireAdmin();
  if (!session) return { kind: "notAllowed" };

  const limit = checkRateLimit(`listing-averages:user:${session.user.id}`, RUN_LIMIT);
  if (!limit.allowed) {
    return { kind: "rateLimited", minutes: Math.max(1, Math.ceil(limit.retryAfter / 60)) };
  }

  try {
    const result = await runListingAveragesJob();
    updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
    revalidatePath("/", "layout");
    return {
      kind: "done",
      written: result.written,
      kept: result.skippedOfficial,
      removed: result.deleted,
    };
  } catch (err) {
    console.error("[listing-averages] recompute failed", err);
    return { kind: "error" };
  }
}
