// Pure — no I/O, no `@/` imports. THE one rule for "which market figures may
// the public and the AI analyst see". Tested in statVisibility.test.ts (runs in
// `npm test`), which also checks that every public reader uses it.
//
// A market figure is publicly visible unless:
//   (a) it was submitted by a user or agency (USER_SUBMITTED) and the owner
//       has not approved it yet (verifiedAt is empty) — decided in the
//       database query by PUBLIC_STAT_WHERE / publicStatWhere(); or
//   (b) it is a sample figure superseded by a real one for the same place,
//       type and month — Step 1's rule, which lives in db/sampleData.ts and is
//       NOT redefined here; publicStats() applies it AFTER (a), so an
//       unapproved figure can never hide a sample one and leave a hole.
//
// Public readers (all five apply (a) in their query, then Step 1's helpers):
//   latestStatsByNeighborhood, latestNeighborhoodStat, neighborhoodTrends
//   (db/market-stats.ts), nearestMarketStat (db/listings.ts), and the stat
//   history in gatherOfferedData (ai/analyst.ts). siteHasOnlySampleData uses
//   (a) too. Admin pages, the review queue and admin counts never apply it —
//   the owner must see every row.

import type { Prisma } from "@prisma/client";
import { dropSupersededSampleStats, type StatKeyFields } from "./db/sampleData";

/** Every row except USER_SUBMITTED rows that have not been approved. */
export const PUBLIC_STAT_WHERE = {
  NOT: { provenance: "USER_SUBMITTED", verifiedAt: null },
} as const satisfies Prisma.MarketStatWhereInput;

/** A reader's own filter, narrowed to publicly visible rows. */
export function publicStatWhere(
  where: Prisma.MarketStatWhereInput = {},
): Prisma.MarketStatWhereInput {
  return { AND: [where, PUBLIC_STAT_WHERE] };
}

/** The same rule (a) for one row already in memory. */
export function isPubliclyVisibleStat(row: {
  provenance: string;
  verifiedAt: Date | string | null;
}): boolean {
  return !(row.provenance === "USER_SUBMITTED" && row.verifiedAt == null);
}

/**
 * Both parts in order: drop unapproved submissions (a), then Step 1's sample
 * rule (b). For rows that did not come through publicStatWhere.
 */
export function publicStats<
  T extends StatKeyFields & { provenance: string; verifiedAt: Date | string | null },
>(rows: T[]): T[] {
  return dropSupersededSampleStats(rows.filter(isPubliclyVisibleStat));
}
