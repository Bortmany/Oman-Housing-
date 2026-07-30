"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import type { InquiryStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import {
  agencyById,
  countListingsInPlay,
  updateAgencyProfile,
} from "@/lib/db/agencies";
import {
  setInquiryStatus,
  inquiryBelongsToAgency,
  INQUIRY_STATUSES,
} from "@/lib/db/inquiries";
import { canAddListing } from "@/lib/tiers";
import {
  DEFAULT_DIAL_CODE,
  checkPhone,
  combinePhone,
  isPossibleEmail,
} from "@/lib/contact";

/** Guard: a logged-in AGENCY user with an agency link. Returns both or null. */
async function requireAgency(): Promise<
  { session: Session; agencyId: string } | null
> {
  const session = await auth();
  if (session?.user.role !== "AGENCY" || !session.user.agencyId) return null;
  return { session, agencyId: session.user.agencyId };
}

// ---------- Submit a new listing (property + listing together) ----------

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;
const OWNERSHIP = ["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"] as const;

const listingSchema = z.object({
  neighborhoodId: z.string().min(1),
  type: z.enum(PROPERTY_TYPES),
  ownership: z.enum(OWNERSHIP),
  titleEn: z.string().trim().min(1).max(200),
  titleAr: z.string().trim().max(200).optional(),
  descriptionEn: z.string().trim().max(5000).optional(),
  descriptionAr: z.string().trim().max(5000).optional(),
  bedrooms: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(50).nullable()),
  bathrooms: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(50).nullable()),
  areaSqm: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().positive().nullable()),
  yearBuilt: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1900).max(2100).nullable()),
  listingType: z.enum(["SALE", "RENT"]),
  price: z.preprocess((v) => Number(v), z.number().finite().positive()),
  rentPeriod: z.enum(["MONTHLY", "ANNUAL"]).nullable(),
});

export type AgencyListingState =
  | {
      error: "validationFailed" | "atListingLimit" | "notAllowed";
      // Which input failed validation (e.g. "price"), so the form can put a
      // red ring on the right box. Absent for form-wide errors.
      field?: string;
    }
  | null;

export async function submitAgencyListing(
  _prev: AgencyListingState,
  formData: FormData,
): Promise<AgencyListingState> {
  const ctx = await requireAgency();
  if (!ctx) return { error: "notAllowed" };

  const agency = await agencyById(ctx.agencyId);
  if (!agency) return { error: "notAllowed" };

  // Plan limit: block a new submission when the agency is already at its cap.
  const inPlay = await countListingsInPlay(ctx.agencyId);
  if (!canAddListing(agency.tier, inPlay)) return { error: "atListingLimit" };

  const parsed = listingSchema.safeParse({
    neighborhoodId: formData.get("neighborhoodId"),
    type: formData.get("type"),
    ownership: formData.get("ownership"),
    titleEn: formData.get("titleEn"),
    titleAr: formData.get("titleAr") || undefined,
    descriptionEn: formData.get("descriptionEn") || undefined,
    descriptionAr: formData.get("descriptionAr") || undefined,
    bedrooms: formData.get("bedrooms"),
    bathrooms: formData.get("bathrooms"),
    areaSqm: formData.get("areaSqm"),
    yearBuilt: formData.get("yearBuilt"),
    listingType: formData.get("listingType"),
    price: formData.get("price"),
    rentPeriod: formData.get("rentPeriod") || null,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      error: "validationFailed",
      field: typeof field === "string" ? field : undefined,
    };
  }
  const d = parsed.data;

  // Create the property (user-submitted, unverified) and the listing
  // (pending review — never live until the owner publishes it) together.
  await prisma.property.create({
    data: {
      neighborhoodId: d.neighborhoodId,
      type: d.type,
      ownership: d.ownership,
      titleEn: d.titleEn,
      titleAr: d.titleAr ?? null,
      descriptionEn: d.descriptionEn ?? null,
      descriptionAr: d.descriptionAr ?? null,
      bedrooms: d.bedrooms,
      bathrooms: d.bathrooms,
      areaSqm: d.areaSqm,
      yearBuilt: d.yearBuilt,
      provenance: "USER_SUBMITTED",
      confidence: 0.5,
      sourceNote: `Submitted by agency: ${agency.nameEn}`,
      listings: {
        create: {
          listingType: d.listingType,
          price: d.price,
          rentPeriod: d.listingType === "RENT" ? (d.rentPeriod ?? "MONTHLY") : null,
          status: "PENDING_REVIEW",
          agencyId: ctx.agencyId,
          createdById: ctx.session.user.id,
          provenance: "USER_SUBMITTED",
          confidence: 0.5,
        },
      },
    },
  });

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/agency/listings?submitted=1", locale });
  return null;
}

// ---------- Enquiry inbox status ----------

export async function setEnquiryStatusAgency(formData: FormData) {
  const ctx = await requireAgency();
  if (!ctx) return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !INQUIRY_STATUSES.includes(status as InquiryStatus)) return;

  // Authz: the enquiry must be on a listing this agency owns.
  if (!(await inquiryBelongsToAgency(id, ctx.agencyId))) return;

  await setInquiryStatus(id, status as InquiryStatus);
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/agency/enquiries", locale });
}

// ---------- Profile ----------

const profileSchema = z
  .object({
    nameEn: z.string().trim().min(2).max(120),
    nameAr: z.string().trim().max(120).optional(),
    licenseNo: z.string().trim().max(60).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .refine(isPossibleEmail)
      .optional(),
    phoneCode: z.string().trim().default(DEFAULT_DIAL_CODE),
    phone: z.string().trim().max(40).optional(),
  })
  // The number must be possible for the country code that was chosen.
  .superRefine((v, ctx) => {
    if (!v.phone) return;
    if (checkPhone(v.phoneCode, v.phone) !== null) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "impossible" });
    }
  });

export type AgencyProfileState =
  | { status: "saved" }
  // `field` names the box that failed, so the form can ring the right one.
  | { status: "error"; field?: string }
  | null;

export async function saveAgencyProfile(
  _prev: AgencyProfileState,
  formData: FormData,
): Promise<AgencyProfileState> {
  const ctx = await requireAgency();
  if (!ctx) return { status: "error" };

  const parsed = profileSchema.safeParse({
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr") || undefined,
    licenseNo: formData.get("licenseNo") || undefined,
    email: formData.get("email") || undefined,
    phoneCode: formData.get("phoneCode") || DEFAULT_DIAL_CODE,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      status: "error",
      field: typeof field === "string" ? field : undefined,
    };
  }
  const d = parsed.data;

  await updateAgencyProfile(ctx.agencyId, {
    nameEn: d.nameEn,
    nameAr: d.nameAr ?? null,
    licenseNo: d.licenseNo ?? null,
    email: d.email ?? null,
    // Code + number stored as one string ("+968 91234567") — no schema change.
    phone: d.phone ? combinePhone(d.phoneCode, d.phone) : null,
  });

  revalidatePath("/", "layout");
  return { status: "saved" };
}
