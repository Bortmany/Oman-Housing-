"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { Tier } from "@prisma/client";
import { redirect } from "@/i18n/navigation";
import { setAgencyApproval, setAgencyTier } from "@/lib/db/agencies";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";

const TIERS = ["FREE", "PREMIUM", "BUSINESS"] as const;

/** Per-admin cap on mutations — a light guard against runaway loops/scripts. */
function adminAllowed(userId: string): boolean {
  return checkRateLimit(`admin:user:${userId}`, {
    limit: 120,
    windowMs: 60_000,
  }).allowed;
}

async function backToAgencies() {
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/agencies", locale });
}

const idSchema = z.object({ id: z.string().trim().min(1).max(64) });
const tierSchema = z.object({
  id: z.string().trim().min(1).max(64),
  tier: z.enum(TIERS),
});

export async function approveAgency(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (parsed.success) await setAgencyApproval(parsed.data.id, true);
  await backToAgencies();
}

export async function unapproveAgency(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (parsed.success) await setAgencyApproval(parsed.data.id, false);
  await backToAgencies();
}

/** Grant a plan by hand — the same switch a payment webhook will flip later. */
export async function grantTier(formData: FormData) {
  const session = await requireAdmin();
  if (!session || !adminAllowed(session.user.id)) return;
  const parsed = tierSchema.safeParse({
    id: formData.get("id"),
    tier: formData.get("tier"),
  });
  if (parsed.success) {
    await setAgencyTier(parsed.data.id, parsed.data.tier as Tier);
  }
  await backToAgencies();
}
