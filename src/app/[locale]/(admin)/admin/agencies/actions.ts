"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { Tier } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { setAgencyApproval, setAgencyTier } from "@/lib/db/agencies";

const TIERS: Tier[] = ["FREE", "PREMIUM", "BUSINESS"];

async function requireAdmin() {
  const session = await auth();
  return session?.user.role === "ADMIN" ? session : null;
}

async function backToAgencies() {
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/agencies", locale });
}

export async function approveAgency(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (id) await setAgencyApproval(id, true);
  await backToAgencies();
}

export async function unapproveAgency(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (id) await setAgencyApproval(id, false);
  await backToAgencies();
}

/** Grant a plan by hand — the same switch a payment webhook will flip later. */
export async function grantTier(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const tier = String(formData.get("tier") ?? "");
  if (id && TIERS.includes(tier as Tier)) await setAgencyTier(id, tier as Tier);
  await backToAgencies();
}
