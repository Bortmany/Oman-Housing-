"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import type { InquiryStatus } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { updateAgencyProfile } from "@/lib/db/agencies";
import {
  setInquiryStatus,
  inquiryBelongsToAgency,
  INQUIRY_STATUSES,
} from "@/lib/db/inquiries";
import {
  DEFAULT_DIAL_CODE,
  checkPhone,
  combinePhone,
  isPossibleEmail,
} from "@/lib/contact";
import { submittedValues, type SubmittedValues } from "@/lib/formValues";

/** Guard: a logged-in AGENCY user with an agency link. Returns both or null. */
async function requireAgency(): Promise<
  { session: Session; agencyId: string } | null
> {
  const session = await auth();
  if (session?.user.role !== "AGENCY" || !session.user.agencyId) return null;
  return { session, agencyId: session.user.agencyId };
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
  // `field` names the box that failed, so the form can ring the right one;
  // `values` carries the edits back so nothing typed is lost.
  | { status: "error"; field?: string; values?: SubmittedValues }
  | null;

/** The boxes handed back when a profile save is rejected. */
const PROFILE_FIELDS = [
  "nameEn", "nameAr", "licenseNo", "email", "phoneCode", "phone",
] as const;

export async function saveAgencyProfile(
  _prev: AgencyProfileState,
  formData: FormData,
): Promise<AgencyProfileState> {
  const typed = submittedValues(formData, PROFILE_FIELDS);

  const ctx = await requireAgency();
  if (!ctx) return { status: "error", values: typed };

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
      values: typed,
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
