// The saved-search alert run (Align Step 5, Build C). Called by
// POST /api/jobs/saved-search-alerts and by the tests.
//
// AT MOST ONCE, by design: for each due search that has new matches, ONE
// database transaction (1) moves lastAlertedAt forward only if nobody else
// already did (compare-and-set) and (2) writes an AlertLog "claimed" row. Only
// after that commits is the email sent. A failed send puts lastAlertedAt back
// (again compare-and-set) so the next hourly run retries; a crash between
// claim and send can lose that one email but can never send it twice.
//
// What matches is exactly what the search page shows: the stored query goes
// through parseSearchFilters + searchListings (ACTIVE only, superseded sample
// rows hidden), and sample rows are dropped here as well. The email is built
// BEFORE the claim, so a build error never swallows an alert.

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { searchListings } from "@/lib/db/listings";
import { isSampleListing } from "@/lib/db/sampleData";
import { parseSearchFilters } from "@/lib/searchFilters";
import { normalizeSearchQuery } from "@/lib/savedSearch";
import {
  buildAlertEmail,
  MAX_LISTINGS_PER_EMAIL,
  toAlertLocale,
  type AlertListing,
} from "@/lib/alerts/template";
import type { EmailMessage, EmailMode, SendResult } from "@/lib/email/send";

export const MAX_EMAILS_PER_USER_PER_DAY = 10;
export const MAX_EMAILS_PER_RUN = 100;
export const DAILY_GAP_MS = 24 * 60 * 60 * 1000;
export const LOG_RETENTION_DAYS = 90;
/** Searches looked at per run (oldest-alerted first, so none starves). */
const MAX_SEARCHES_SCANNED = 1000;
/** Most matches fetched per search (the email shows 5 and counts the rest). */
const MATCH_FETCH_LIMIT = 200;

export type AlertRunResult = {
  status: "ok" | "not-configured";
  mode: EmailMode;
  checked: number;
  due: number;
  sent: number;
  failed: number;
  deferred: number;
};

export type AlertRunOptions = {
  mode: EmailMode;
  send: (message: EmailMessage) => Promise<SendResult>;
  /** Run start; also the "published up to" moment. Defaults to now. */
  now?: Date;
  baseUrl: string;
  maxPerUser?: number;
  maxPerRun?: number;
};

const DAY_MS = DAILY_GAP_MS;

export async function runSavedSearchAlerts(
  opts: AlertRunOptions,
): Promise<AlertRunResult> {
  const now = opts.now ?? new Date();
  const maxPerUser = opts.maxPerUser ?? MAX_EMAILS_PER_USER_PER_DAY;
  const maxPerRun = opts.maxPerRun ?? MAX_EMAILS_PER_RUN;
  const result: AlertRunResult = {
    status: opts.mode === "off" ? "not-configured" : "ok",
    mode: opts.mode,
    checked: 0,
    due: 0,
    sent: 0,
    failed: 0,
    deferred: 0,
  };

  // Housekeeping: the privacy page promises logs are kept 90 days.
  await prisma.alertLog
    .deleteMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - LOG_RETENTION_DAYS * DAY_MS) },
      },
    })
    .catch((err) => logger.warn("alerts.cleanup.failed", { name: errName(err) }));

  const searches = await prisma.savedSearch.findMany({
    orderBy: [{ lastAlertedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: MAX_SEARCHES_SCANNED,
    include: { user: { select: { id: true, email: true, name: true, locale: true } } },
  });
  result.checked = searches.length;

  let claimedThisRun = 0;

  for (const search of searches) {
    try {
      const last = search.lastAlertedAt;
      const dueNow =
        search.frequency === "instant" ||
        !last ||
        now.getTime() - last.getTime() >= DAILY_GAP_MS;
      if (!dueNow) continue;
      if (!search.user.email) continue;

      // Same rules as the search page: parse the stored query, then search.
      const query = normalizeSearchQuery(search.query);
      const since = last ?? search.createdAt;
      const rows = await searchListings({
        ...parseSearchFilters(new URLSearchParams(query)),
        publishedAfter: since,
        publishedUntil: now,
        limit: MATCH_FETCH_LIMIT,
      });
      const matches = rows.filter((r) => !isSampleListing(r));
      if (matches.length === 0) continue;
      result.due++;

      // Email not connected: note it (once a day per search) and move nothing.
      if (opts.mode === "off") {
        const recent = await prisma.alertLog.findFirst({
          where: {
            savedSearchId: search.id,
            status: "not-configured",
            createdAt: { gt: new Date(now.getTime() - DAY_MS) },
          },
          select: { id: true },
        });
        if (!recent) {
          await prisma.alertLog.create({
            data: {
              userId: search.userId,
              savedSearchId: search.id,
              frequency: search.frequency,
              matchedCount: matches.length,
              status: "not-configured",
              reason: "email_not_configured",
            },
          });
        }
        result.deferred++;
        continue;
      }

      if (claimedThisRun >= maxPerRun) {
        result.deferred++;
        continue;
      }
      const sentToday = await prisma.alertLog.count({
        where: {
          userId: search.userId,
          status: { in: ["claimed", "sent"] },
          createdAt: { gt: new Date(now.getTime() - DAY_MS) },
        },
      });
      if (sentToday >= maxPerUser) {
        result.deferred++;
        continue;
      }

      const listings: AlertListing[] = matches
        .slice(0, MAX_LISTINGS_PER_EMAIL)
        .map((m) => ({
          propertyId: m.propertyId,
          titleEn: m.property.titleEn,
          titleAr: m.property.titleAr,
          neighborhoodEn: m.property.neighborhood.nameEn,
          neighborhoodAr: m.property.neighborhood.nameAr,
          type: m.property.type,
          bedrooms: m.property.bedrooms,
          listingType: m.listingType,
          rentPeriod: m.rentPeriod,
          price: m.price.toString(),
          provenance: m.provenance,
          isSample: false,
        }));
      const email = buildAlertEmail({
        locale: toAlertLocale(search.user.locale),
        name: search.name,
        userName: search.user.name,
        listings,
        totalNew: matches.length,
        baseUrl: opts.baseUrl,
        query,
      });
      const newestId = matches[0].id; // searchListings returns newest first

      // Claim: compare-and-set + log, in one transaction.
      const logId = await prisma.$transaction(async (tx) => {
        const claim = await tx.savedSearch.updateMany({
          where: { id: search.id, lastAlertedAt: last },
          data: { lastAlertedAt: now, lastMatchedListingId: newestId },
        });
        if (claim.count === 0) return null; // another run got there first
        const log = await tx.alertLog.create({
          data: {
            userId: search.userId,
            savedSearchId: search.id,
            frequency: search.frequency,
            matchedCount: matches.length,
            status: "claimed",
          },
          select: { id: true },
        });
        return log.id;
      });
      if (!logId) continue;
      claimedThisRun++;

      const outcome = await opts.send({
        to: search.user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        outboxName: search.id,
      });

      if (outcome.status === "sent" || outcome.status === "outbox") {
        await prisma.alertLog.update({ where: { id: logId }, data: { status: "sent" } });
        result.sent++;
      } else {
        const reason =
          outcome.status === "failed" ? outcome.reason : "email_not_configured";
        await prisma.alertLog.update({
          where: { id: logId },
          data: { status: outcome.status === "failed" ? "failed" : "not-configured", reason },
        });
        // Put the search back so the next run retries (only if still ours).
        await prisma.savedSearch.updateMany({
          where: { id: search.id, lastAlertedAt: now },
          data: { lastAlertedAt: last, lastMatchedListingId: search.lastMatchedListingId },
        });
        result.failed++;
      }
    } catch (err) {
      // One search failing never stops the rest. Ids only — no addresses.
      result.failed++;
      logger.error("alerts.search.failed", err, { savedSearchId: search.id });
      await reportToSentry(err, search.id);
    }
  }

  return result;
}

async function reportToSentry(err: unknown, savedSearchId: string) {
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, { tags: { job: "saved-search-alerts" }, extra: { savedSearchId } });
  } catch {
    /* error tracking must never break the job */
  }
}

const errName = (err: unknown) => (err instanceof Error ? err.name : "unknown");
