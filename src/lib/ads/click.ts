// What happens when someone clicks an ad (pure; the database and the rate
// limit are passed in so this can be tested without either).
//
// The destination is ONLY the link stored on the campaign. Nothing from the
// address bar is ever used, so this cannot be turned into an open redirect.
// The link is re-checked as https at redirect time as well as at save time.

import { isCampaignLive, parseAdLink } from "./rules";

export type ClickCampaign = { linkUrl: string; isActive: boolean; startsAt: Date; endsAt: Date };

export type ClickDeps = {
  find(id: string): Promise<ClickCampaign | null>;
  /** true = this visitor may be counted now (rate limit). */
  allowCount(): boolean;
  count(id: string): Promise<void>;
  now: Date;
};

export type ClickResult =
  | { status: 404 }
  | { status: 302; location: string; counted: boolean };

const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

export async function resolveClick(id: string, deps: ClickDeps): Promise<ClickResult> {
  if (!ID_SHAPE.test(id)) return { status: 404 };
  const campaign = await deps.find(id);
  if (!campaign) return { status: 404 };
  // Paused, ended or not-yet-started campaigns are not served at all.
  if (!isCampaignLive(campaign, deps.now)) return { status: 404 };
  const location = parseAdLink(campaign.linkUrl);
  if (!location) return { status: 404 };

  // Redirect a live campaign; count it only within the rate limit.
  let counted = false;
  if (deps.allowCount()) {
    try {
      await deps.count(id);
      counted = true;
    } catch {
      // A counting hiccup must never stop the visitor reaching the advertiser.
    }
  }
  return { status: 302, location, counted };
}
