"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@prisma/client";
import { redirect } from "@/i18n/navigation";
import { setInquiryStatus, INQUIRY_STATUSES } from "@/lib/db/inquiries";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";

const statusSchema = z.object({
  id: z.string().trim().min(1).max(64),
  status: z.enum(INQUIRY_STATUSES as [InquiryStatus, ...InquiryStatus[]]),
});

export async function setInquiryStatusAdmin(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;

  // Per-admin cap on mutations — a light guard against runaway loops/scripts.
  const { allowed } = checkRateLimit(`admin:user:${session.user.id}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await setInquiryStatus(parsed.data.id, parsed.data.status);
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/inquiries", locale });
}
