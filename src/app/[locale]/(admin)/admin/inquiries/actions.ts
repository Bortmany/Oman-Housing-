"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { setInquiryStatus, INQUIRY_STATUSES } from "@/lib/db/inquiries";

export async function setInquiryStatusAdmin(formData: FormData) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !INQUIRY_STATUSES.includes(status as InquiryStatus)) return;

  await setInquiryStatus(id, status as InquiryStatus);
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/inquiries", locale });
}
