"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { PROVENANCE_VALUES } from "@/lib/provenance";
import { requireAdmin } from "@/lib/require-admin";
import { submittedValues, type SubmittedValues } from "@/lib/formValues";

const listingSchema = z.object({
  id: z.string().optional(),
  propertyId: z.string().min(1),
  listingType: z.enum(["SALE", "RENT"]),
  price: z.preprocess((v) => Number(v), z.number().finite().positive()),
  rentPeriod: z.enum(["MONTHLY", "ANNUAL"]).nullable(),
  provenance: z.enum(PROVENANCE_VALUES),
  confidence: z.preprocess((v) => Number(v), z.number().min(0).max(1)),
});

export type ListingFormState = {
  error?: "validationFailed";
  // What was typed, so a rejected listing is never re-keyed by hand.
  values?: SubmittedValues;
} | null;

/** The boxes handed back when a listing is rejected. */
const LISTING_FIELDS = [
  "propertyId", "listingType", "price", "rentPeriod", "provenance", "confidence",
] as const;

export async function saveListing(
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const typed = submittedValues(formData, LISTING_FIELDS);

  const session = await requireAdmin();
  if (!session) return { error: "validationFailed", values: typed };

  const parsed = listingSchema.safeParse({
    id: formData.get("id") || undefined,
    propertyId: formData.get("propertyId"),
    listingType: formData.get("listingType"),
    price: formData.get("price"),
    rentPeriod: formData.get("rentPeriod") || null,
    provenance: formData.get("provenance"),
    confidence: formData.get("confidence"),
  });
  if (!parsed.success) return { error: "validationFailed", values: typed };

  const d = parsed.data;
  const data = {
    propertyId: d.propertyId,
    listingType: d.listingType,
    price: d.price,
    rentPeriod: d.listingType === "RENT" ? (d.rentPeriod ?? "MONTHLY") : null,
    provenance: d.provenance,
    confidence: d.confidence,
  };

  const listing = d.id
    ? await prisma.listing.update({ where: { id: d.id }, data })
    : await prisma.listing.create({
        data: { ...data, status: "DRAFT", createdById: session.user.id },
      });

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/admin/listings/${listing.id}?saved=1`, locale });
  return null;
}

async function setStatus(id: string, status: ListingStatus) {
  const session = await requireAdmin();
  if (!session || !id) return;

  await prisma.listing.update({
    where: { id },
    data: {
      status,
      ...(status === "ACTIVE" ? { publishedAt: new Date() } : {}),
    },
  });
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/admin/listings/${id}`, locale });
}

export async function publishListing(formData: FormData) {
  await setStatus(String(formData.get("id") ?? ""), "ACTIVE");
}

export async function rejectListing(formData: FormData) {
  await setStatus(String(formData.get("id") ?? ""), "REJECTED");
}

export async function archiveListing(formData: FormData) {
  await setStatus(String(formData.get("id") ?? ""), "ARCHIVED");
}

export async function deleteListing(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (id) await prisma.listing.delete({ where: { id } });

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/listings?deleted=1", locale });
}
