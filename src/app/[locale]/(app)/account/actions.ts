"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { safePath } from "@/lib/safePath";
import { localName } from "@/lib/i18nData";
import { formatOMRWhole } from "@/lib/money";
import {
  countSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  findSavedSearchByQuery,
} from "@/lib/db/saved-searches";
import {
  DEFAULT_FREQUENCY,
  MAX_SAVED_SEARCHES,
  isFrequency,
  normalizeSearchQuery,
  searchQueryToObject,
} from "@/lib/savedSearch";

// Saving and deleting a property search. Both actions check the signed-in user
// first and only ever touch that user's own rows.

const PROPERTY_TYPES = z.enum([
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
]);
const OWNERSHIP = z.enum([
  "OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN",
]);

const MAX_NAME_LENGTH = 120;

/**
 * A plain-language name for a search, built from its filters — e.g.
 * "Al Mouj · Villa · For sale · up to OMR 250,000". Written in the language
 * the visitor was browsing in when they saved it.
 */
async function describeSearch(query: string, locale: string): Promise<string> {
  const params = searchQueryToObject(query);
  const [t, te] = await Promise.all([
    getTranslations({ locale, namespace: "properties" }),
    getTranslations({ locale, namespace: "enums" }),
  ]);

  const parts: string[] = [];

  if (params.hood) {
    const hood = await prisma.neighborhood.findUnique({
      where: { slug: params.hood },
      select: { nameEn: true, nameAr: true },
    });
    if (hood) parts.push(localName(locale, hood.nameEn, hood.nameAr));
  }

  const type = PROPERTY_TYPES.safeParse(params.type);
  if (type.success) parts.push(te(`propertyType.${type.data}`));

  if (params.listingType === "SALE" || params.listingType === "RENT") {
    parts.push(params.listingType === "SALE" ? t("sale") : t("rent"));
  }

  if (params.beds && Number.isFinite(Number(params.beds))) {
    parts.push(t("bedroomsPlus", { count: Number(params.beds) }));
  }

  if (params.minPrice && Number.isFinite(Number(params.minPrice))) {
    parts.push(t("chipMinPrice", { value: formatOMRWhole(params.minPrice, locale) }));
  }
  if (params.maxPrice && Number.isFinite(Number(params.maxPrice))) {
    parts.push(t("chipMaxPrice", { value: formatOMRWhole(params.maxPrice, locale) }));
  }

  const ownership = OWNERSHIP.safeParse(params.ownership);
  if (ownership.success) parts.push(te(`ownership.${ownership.data}`));

  const name = parts.length > 0 ? parts.join(" · ") : t("savedSearchAll");
  return name.slice(0, MAX_NAME_LENGTH);
}

const saveSchema = z.object({
  query: z.string().max(500),
  frequency: z.string().max(20),
});

export async function saveSearchAction(formData: FormData) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const redirectTo = safePath(formData.get("redirectTo"), "/properties");

  if (!session) {
    redirect({
      href: { pathname: "/login", query: { callbackUrl: redirectTo } },
      locale,
    });
    return;
  }

  // Per-user cap so one account cannot fill the table in a loop.
  const { allowed } = checkRateLimit(`saved-search:user:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    redirect({ href: redirectTo, locale });
    return;
  }

  const parsed = saveSchema.safeParse({
    query: formData.get("query") ?? "",
    frequency: formData.get("frequency") ?? DEFAULT_FREQUENCY,
  });

  if (parsed.success) {
    const query = normalizeSearchQuery(parsed.data.query);
    const frequency = isFrequency(parsed.data.frequency)
      ? parsed.data.frequency
      : DEFAULT_FREQUENCY;
    const [existing, count] = await Promise.all([
      findSavedSearchByQuery(session.user.id, query),
      countSavedSearches(session.user.id),
    ]);
    // Saving the same search twice is a no-op, and nobody keeps more than the
    // ceiling — both fail quietly, the page just shows what is saved.
    if (!existing && count < MAX_SAVED_SEARCHES) {
      await createSavedSearch({
        userId: session.user.id,
        name: await describeSearch(query, locale),
        query,
        frequency,
      });
    }
  }

  revalidatePath("/", "layout");
  redirect({ href: redirectTo, locale });
}

const deleteSchema = z.object({ id: z.string().trim().min(1).max(64) });

export async function deleteSavedSearchAction(formData: FormData) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const redirectTo = safePath(formData.get("redirectTo"), "/account");
  if (!session) {
    redirect({
      href: { pathname: "/login", query: { callbackUrl: redirectTo } },
      locale,
    });
    return;
  }

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (parsed.success) {
    // Scoped to this user — someone else's id simply deletes nothing.
    await deleteSavedSearch(session.user.id, parsed.data.id);
  }

  revalidatePath("/", "layout");
  redirect({ href: redirectTo, locale });
}
