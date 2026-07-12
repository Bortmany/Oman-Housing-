"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { toggleFavorite } from "@/lib/db/favorites";

/** Only relative in-app paths — never an absolute URL (open-redirect guard). */
function safePath(raw: unknown): string {
  const s = String(raw ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/properties";
}

export async function toggleFavoriteAction(formData: FormData) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const listingId = String(formData.get("listingId") ?? "");
  const redirectTo = safePath(formData.get("redirectTo"));

  if (!session) {
    redirect({
      href: { pathname: "/login", query: { callbackUrl: redirectTo } },
      locale,
    });
    return;
  }

  if (listingId) await toggleFavorite(session.user.id, listingId);
  revalidatePath("/", "layout");
  redirect({ href: redirectTo, locale });
}
