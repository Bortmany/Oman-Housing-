"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { signIn } from "@/auth";
import { createAgencyWithOwner } from "@/lib/db/agencies";
import {
  DEFAULT_DIAL_CODE,
  checkPhone,
  combinePhone,
  isPossibleEmail,
} from "@/lib/contact";
import { submittedValues, type SubmittedValues } from "@/lib/formValues";

const signupSchema = z
  .object({
    agencyNameEn: z.string().trim().min(2).max(120),
    agencyNameAr: z.string().trim().max(120).optional(),
    licenseNo: z.string().trim().max(60).optional(),
    phoneCode: z.string().trim().default(DEFAULT_DIAL_CODE),
    phone: z.string().trim().max(40).optional(),
    contactName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().max(200).refine(isPossibleEmail),
    password: z.string().min(8).max(200),
  })
  // The number must be possible for the country code that was chosen.
  .superRefine((v, ctx) => {
    if (!v.phone) return;
    if (checkPhone(v.phoneCode, v.phone) !== null) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "impossible" });
    }
  });

export type AgencySignupState =
  | {
      error: "emailTaken" | "signupFailed";
      field?: string;
      // What the agency typed, so a rejected signup is never retyped.
      // The password is never in here.
      values?: SubmittedValues;
    }
  | null;

/** The boxes handed back when the signup is rejected — never the password. */
const SIGNUP_FIELDS = [
  "agencyNameEn",
  "agencyNameAr",
  "licenseNo",
  "phoneCode",
  "phone",
  "contactName",
  "email",
] as const;

export async function signUpAgency(
  _prev: AgencySignupState,
  formData: FormData,
): Promise<AgencySignupState> {
  const typed = submittedValues(formData, SIGNUP_FIELDS);

  const parsed = signupSchema.safeParse({
    agencyNameEn: formData.get("agencyNameEn"),
    agencyNameAr: formData.get("agencyNameAr") || undefined,
    licenseNo: formData.get("licenseNo") || undefined,
    phoneCode: formData.get("phoneCode") || DEFAULT_DIAL_CODE,
    phone: formData.get("phone") || undefined,
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    // Name the box that failed so the form can ring it, same as the other actions.
    const field = parsed.error.issues[0]?.path[0];
    return {
      error: "signupFailed",
      field: typeof field === "string" ? field : undefined,
      values: typed,
    };
  }
  const d = parsed.data;
  const locale = await getLocale();

  const result = await createAgencyWithOwner({
    agencyNameEn: d.agencyNameEn,
    agencyNameAr: d.agencyNameAr ?? null,
    licenseNo: d.licenseNo ?? null,
    // Code + number stored as one string ("+968 91234567") — no schema change.
    phone: d.phone ? combinePhone(d.phoneCode, d.phone) : null,
    contactName: d.contactName,
    email: d.email,
    passwordHash: await bcrypt.hash(d.password, 10),
    locale,
  });
  if (!result.ok) return { error: "emailTaken", values: typed };

  // Sign the new agency owner in and drop them into their portal.
  await signIn("credentials", {
    email: d.email,
    password: d.password,
    redirectTo: `/${locale}/agency`,
  });
  return null;
}
