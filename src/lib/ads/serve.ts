import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { findLiveCampaign, recordAdView } from "./core";
import { buildAdView, isBotUserAgent, type AdSlotName, type AdView } from "./rules";

/**
 * The ad to show in a slot, or null (then the page shows nothing at all).
 * Counts one view after the page is sent: skipped for crawlers and link-preview
 * bots, and counted once per visitor address per campaign per 10 minutes.
 * An ad problem never breaks the page it sits on.
 */
export async function loadAd(slot: AdSlotName, neighborhoodId?: string | null): Promise<AdView | null> {
  try {
    const campaign = await findLiveCampaign(slot, neighborhoodId);
    if (!campaign) return null;

    const [t, locale, h] = await Promise.all([getTranslations("ads"), getLocale(), headers()]);
    const view = buildAdView(campaign, locale, {
      linkHint: t("linkHint", { name: campaign.advertiser }),
      by: t("by", { name: campaign.advertiser }),
      altFallback: t("imageAltFallback", { name: campaign.advertiser }),
    });

    if (
      !isBotUserAgent(h.get("user-agent")) &&
      checkRateLimit(`ad:view:${campaign.id}:ip:${getClientIp(h)}`, { limit: 1, windowMs: 10 * 60_000 }).allowed
    ) {
      after(() => recordAdView(campaign.id).catch((err) => logger.error("ads.view.failed", err, { campaignId: campaign.id })));
    }
    return view;
  } catch (err) {
    logger.error("ads.load.failed", err, { slot });
    return null;
  }
}
