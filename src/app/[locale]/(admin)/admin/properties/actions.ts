"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { MARKET_DATA_CACHE_TAG } from "@/lib/db/market-stats";
import { requireAdmin } from "@/lib/require-admin";
import { savePropertyImage, deleteStoredFile } from "@/lib/storage";
import { submittedValues, type SubmittedValues } from "@/lib/formValues";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;
const OWNERSHIP = ["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"] as const;
const PROVENANCE = ["VERIFIED", "OFFICIAL_STAT", "USER_SUBMITTED", "AI_ESTIMATED"] as const;

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite().nullable(),
);
const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Math.round(Number(v))),
  z.number().int().min(0).nullable(),
);

const propertySchema = z.object({
  id: z.string().optional(),
  neighborhoodId: z.string().min(1),
  type: z.enum(PROPERTY_TYPES),
  ownership: z.enum(OWNERSHIP),
  titleEn: z.string().trim().min(1).max(200),
  titleAr: z.string().trim().max(200).optional(),
  descriptionEn: z.string().trim().max(5000).optional(),
  descriptionAr: z.string().trim().max(5000).optional(),
  bedrooms: optionalInt,
  bathrooms: optionalInt,
  areaSqm: optionalNumber,
  plotSqm: optionalNumber,
  yearBuilt: optionalInt,
  furnished: z.preprocess((v) => v === "on", z.boolean()),
  lat: optionalNumber,
  lng: optionalNumber,
  provenance: z.enum(PROVENANCE),
  confidence: z.preprocess((v) => Number(v), z.number().min(0).max(1)),
  sourceNote: z.string().trim().max(500).optional(),
});

export type PropertyFormState = {
  error?: "validationFailed" | "imageTooLarge" | "imageWrongType";
  // What was typed, so a rejected property is never re-keyed by hand.
  // (Chosen photo files cannot be handed back — the browser owns those.)
  values?: SubmittedValues;
} | null;

/** The boxes handed back when a property is rejected. */
const PROPERTY_FIELDS = [
  "neighborhoodId", "type", "ownership", "titleEn", "titleAr",
  "descriptionEn", "descriptionAr", "bedrooms", "bathrooms", "areaSqm",
  "plotSqm", "yearBuilt", "furnished", "lat", "lng", "provenance",
  "confidence", "sourceNote",
] as const;

export async function saveProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  // Held on to now so every "no" below can hand the typed form straight back.
  const typed = submittedValues(formData, PROPERTY_FIELDS);

  const session = await requireAdmin();
  if (!session) return { error: "validationFailed", values: typed };

  const parsed = propertySchema.safeParse({
    id: formData.get("id") || undefined,
    neighborhoodId: formData.get("neighborhoodId"),
    type: formData.get("type"),
    ownership: formData.get("ownership"),
    titleEn: formData.get("titleEn"),
    titleAr: formData.get("titleAr") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    descriptionAr: formData.get("descriptionAr") ?? "",
    bedrooms: formData.get("bedrooms"),
    bathrooms: formData.get("bathrooms"),
    areaSqm: formData.get("areaSqm"),
    plotSqm: formData.get("plotSqm"),
    yearBuilt: formData.get("yearBuilt"),
    furnished: formData.get("furnished"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    provenance: formData.get("provenance"),
    confidence: formData.get("confidence"),
    sourceNote: formData.get("sourceNote") ?? "",
  });
  if (!parsed.success) return { error: "validationFailed", values: typed };

  const d = parsed.data;
  const data = {
    neighborhoodId: d.neighborhoodId,
    type: d.type,
    ownership: d.ownership,
    titleEn: d.titleEn,
    titleAr: d.titleAr || null,
    descriptionEn: d.descriptionEn || null,
    descriptionAr: d.descriptionAr || null,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    areaSqm: d.areaSqm,
    plotSqm: d.plotSqm,
    yearBuilt: d.yearBuilt,
    furnished: d.furnished,
    lat: d.lat,
    lng: d.lng,
    provenance: d.provenance,
    confidence: d.confidence,
    sourceNote: d.sourceNote || null,
    ...(d.provenance === "VERIFIED"
      ? { verifiedById: session.user.id, verifiedAt: new Date() }
      : {}),
  };

  const property = d.id
    ? await prisma.property.update({ where: { id: d.id }, data })
    : await prisma.property.create({ data });

  // Attach any uploaded photos.
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const existingCount = await prisma.propertyImage.count({
      where: { propertyId: property.id },
    });
    let sort = existingCount;
    for (const file of files) {
      const saved = await savePropertyImage(property.id, file);
      if ("error" in saved) {
        return {
          error: saved.error === "size" ? "imageTooLarge" : "imageWrongType",
          values: typed,
        };
      }
      await prisma.propertyImage.create({
        data: {
          propertyId: property.id,
          storagePath: saved.path,
          sortOrder: sort,
          isPrimary: sort === 0,
        },
      });
      sort++;
    }
  }

  updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/admin/properties/${property.id}?saved=1`, locale });
  return null;
}

export async function deleteProperty(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (id) {
    const images = await prisma.propertyImage.findMany({
      where: { propertyId: id },
    });
    await prisma.property.delete({ where: { id } });
    for (const img of images) await deleteStoredFile(img.storagePath);
  }

  updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/properties?deleted=1", locale });
}

export async function deletePropertyImage(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("imageId") ?? "");
  if (!id) return;
  const img = await prisma.propertyImage.findUnique({ where: { id } });
  if (!img) return;

  await prisma.propertyImage.delete({ where: { id } });
  await deleteStoredFile(img.storagePath);

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/admin/properties/${img.propertyId}`, locale });
}

export async function makePrimaryImage(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("imageId") ?? "");
  if (!id) return;
  const img = await prisma.propertyImage.findUnique({ where: { id } });
  if (!img) return;

  await prisma.$transaction([
    prisma.propertyImage.updateMany({
      where: { propertyId: img.propertyId },
      data: { isPrimary: false },
    }),
    prisma.propertyImage.update({
      where: { id },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/admin/properties/${img.propertyId}`, locale });
}
