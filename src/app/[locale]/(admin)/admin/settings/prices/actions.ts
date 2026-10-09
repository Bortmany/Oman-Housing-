"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";
import { recordEvent } from "@/lib/payments/core";
import { getSetting } from "@/lib/siteSettings";
import { writePrice } from "@/lib/payments/prices";
import { PRICE_KEYS, parseDays, parsePriceAmount, type PriceKey } from "@/lib/payments/priceCore";

const KEYS = new Set<string>(Object.values(PRICE_KEYS));

async function back(query: string): Promise<never> {
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/admin/settings/prices?${query}`, locale });
  throw new Error("unreachable");
}

/** Save ONE price. Admin only (house rule 7); changes apply to future payments only. */
export async function savePriceAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return back("error=failed");
  if (!checkRateLimit(`admin:user:${session.user.id}`, { limit: 120, windowMs: 60_000 }).allowed) {
    return back("error=tooMany");
  }

  const key = formData.get("key");
  if (typeof key !== "string" || !KEYS.has(key)) return back("error=failed");
  const raw = String(formData.get("value") ?? "").slice(0, 20);

  const isDays = key === PRICE_KEYS.featuredDays;
  const clean = isDays ? parseDays(raw)?.toString() : parsePriceAmount(raw);
  if (!clean) return back(`error=${isDays ? "invalidDays" : "invalid"}&key=${encodeURIComponent(key)}`);

  const before = await getSetting(key as PriceKey);
  await writePrice(key as PriceKey, clean);
  await recordEvent("PRICE_CHANGED", `${key}: ${before ?? "built-in"} -> ${clean} (future payments only)`);
  return back(`saved=${encodeURIComponent(key)}`);
}
