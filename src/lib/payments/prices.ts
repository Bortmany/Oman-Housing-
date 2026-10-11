import "server-only";
import { getSetting, getSettingUpdatedAt, setSetting } from "@/lib/siteSettings";
import { PRICE_KEYS, featuredPriceFor, type FeaturedPrice, type PriceKey } from "./priceCore";

// The server-side price reader. Prices are always read here, on the server,
// at the moment a checkout starts, and frozen on the Payment. The browser
// never sends an amount.

const FEATURED_KEYS = [PRICE_KEYS.featuredOwner, PRICE_KEYS.featuredAgency, PRICE_KEYS.featuredDays] as const;

export async function getFeaturedPrice(agencyId: string | null): Promise<FeaturedPrice> {
  const values = await Promise.all(FEATURED_KEYS.map((k) => getSetting(k)));
  const settings: Partial<Record<PriceKey, string | null>> = {};
  FEATURED_KEYS.forEach((k, i) => (settings[k] = values[i]));
  return featuredPriceFor(agencyId, settings);
}

/** Every price key with its stored text (null = default) and when it was last changed. */
export async function getAllPriceRows() {
  const keys = Object.values(PRICE_KEYS);
  return Promise.all(
    keys.map(async (key) => ({
      key,
      raw: await getSetting(key),
      changedAt: await getSettingUpdatedAt(key),
    })),
  );
}

export async function writePrice(key: PriceKey, value: string): Promise<void> {
  await setSetting(key, value);
}
