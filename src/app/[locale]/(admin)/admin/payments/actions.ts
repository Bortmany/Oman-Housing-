"use server";

// Admin money actions: feature a listing by hand (a direct bank-transfer
// deal), stop featuring, re-check a card payment with the gateway. Each one
// re-checks the ADMIN role itself (house rule 7) and shares the per-admin
// limiter (120/min). Every hand action is written to the payment log.

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";
import { featureByHand, stopFeaturing } from "@/lib/payments/core";
import { settlePayment } from "@/lib/payments/service";

async function back(query: string): Promise<never> {
  revalidatePath("/", "layout"); // search order and the Featured tag change at once
  const locale = await getLocale();
  redirect({ href: `/admin/payments?${query}`, locale });
  throw new Error("unreachable");
}

async function gate() {
  const session = await requireAdmin();
  if (!session) return null;
  const limit = checkRateLimit(`admin:user:${session.user.id}`, { limit: 120, windowMs: 60_000 });
  return limit.allowed ? { session } : { session, tooMany: true as const };
}

const text = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function featureByHandAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return back("error=failed");
  if ("tooMany" in g) return back("error=tooMany");

  const days = /^\d{1,3}$/.test(text(formData.get("days"), 6)) ? Number(text(formData.get("days"), 6)) : NaN;
  const result = await featureByHand(g.session.user.id, {
    listingId: text(formData.get("listingId"), 64),
    days,
    amount: text(formData.get("amount"), 20).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)),
    note: text(formData.get("note"), 300),
  });
  return back(result.ok ? "done=hand" : `error=${result.error}`);
}

export async function stopFeaturingAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return back("error=failed");
  if ("tooMany" in g) return back("error=tooMany");
  const result = await stopFeaturing(g.session.user.id, text(formData.get("listingId"), 64), text(formData.get("reason"), 150));
  return back(result.ok ? "done=stopped" : "error=failed");
}

export async function recheckPaymentAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return back("error=failed");
  if ("tooMany" in g) return back("error=tooMany");
  await settlePayment(text(formData.get("paymentId"), 64), { logUnknown: false });
  return back("done=rechecked");
}
