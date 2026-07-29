"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { signIn } from "@/auth";
import { createAgencyWithOwner } from "@/lib/db/agencies";

const signupSchema = z.object({
  agencyNameEn: z.string().trim().min(2).max(120),
  agencyNameAr: z.string().trim().max(120).optional(),
  licenseNo: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(40).optional(),
  contactName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export type AgencySignupState =
  | { error: "emailTaken" | "signupFailed"; field?: string }
  | null;

export async function signUpAgency(
  _prev: AgencySignupState,
  formData: FormData,
): Promise<AgencySignupState> {
  const parsed = signupSchema.safeParse({
    agencyNameEn: formData.get("agencyNameEn"),
    agencyNameAr: formData.get("agencyNameAr") || undefined,
    licenseNo: formData.get("licenseNo") || undefined,
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
    };
  }
  const d = parsed.data;
  const locale = await getLocale();

  const result = await createAgencyWithOwner({
    agencyNameEn: d.agencyNameEn,
    agencyNameAr: d.agencyNameAr ?? null,
    licenseNo: d.licenseNo ?? null,
    phone: d.phone ?? null,
    contactName: d.contactName,
    email: d.email,
    passwordHash: await bcrypt.hash(d.password, 10),
    locale,
  });
  if (!result.ok) return { error: "emailTaken" };

  // Sign the new agency owner in and drop them into their portal.
  await signIn("credentials", {
    email: d.email,
    password: d.password,
    redirectTo: `/${locale}/agency`,
  });
  return null;
}
