"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { toggleFavorite } from "@/lib/db/favorites";
import { checkRateLimit } from "@/lib/rate-limit";
import { safePath } from "@/lib/safePath";

const toggleSchema = z.object({
  listingId: z.string().trim().min(1).max(64),
});

export async function toggleFavoriteAction(formData: FormData) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const redirectTo = safePath(formData.get("redirectTo"), "/properties");

  if (!session) {
    redirect({
      href: { pathname: "/login", query: { callbackUrl: redirectTo } },
      locale,
    });
    return;
  }

  // Per-user cap so one account cannot hammer the toggle in a loop.
  const { allowed } = checkRateLimit(`favorite:user:${session.user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!allowed) {
    redirect({ href: redirectTo, locale });
    return;
  }

  const parsed = toggleSchema.safeParse({
    listingId: formData.get("listingId"),
  });
  if (parsed.success) {
    await toggleFavorite(session.user.id, parsed.data.listingId);
  }
  revalidatePath("/", "layout");
  redirect({ href: redirectTo, locale });
}
