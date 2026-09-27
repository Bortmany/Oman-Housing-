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
import { checkRateLimit, getAnonRateLimitKey } from "@/lib/rate-limit";
import { CAPTCHA_FIELD, issueCaptchaPass, verifyCaptcha } from "@/lib/captcha";
import {
  INVITE_ATTEMPT_LIMIT,
  INVITE_CODE_FIELD,
  checkInviteCode,
  getSignupMode,
} from "@/lib/signupMode";

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
      error:
        | "emailTaken"
        | "signupFailed"
        | "rateLimited"
        | "captchaFailed"
        | "inviteRequired"
        | "signupClosed";
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

  // Throttle agency signups per visitor (same pattern as user registration)
  // so nobody can bulk-create agencies and flood the approval queue.
  const anonKey = await getAnonRateLimitKey();
  const { allowed } = checkRateLimit(`agencysignup:ip:${anonKey}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) return { error: "rateLimited", values: typed };

  // Invitation-only gate (src/lib/signupMode.ts) — same rule as buyer
  // registration. Checked before the CAPTCHA so a wrong code never burns a
  // single-use CAPTCHA token for nothing.
  const mode = getSignupMode();
  if (mode === "closed") return { error: "signupClosed", values: typed };
  if (mode === "invite" && !checkInviteCode(formData.get(INVITE_CODE_FIELD))) {
    // Only FAILED code attempts count here; the signup limiter above already
    // bounds total submissions. Never echo the code back.
    const attempt = checkRateLimit(`invitecode:ip:${anonKey}`, INVITE_ATTEMPT_LIMIT);
    return { error: attempt.allowed ? "inviteRequired" : "rateLimited", values: typed };
  }

  // Dormant CAPTCHA (src/lib/captcha.ts) — always passes until keyed.
  if (!(await verifyCaptcha(formData.get(CAPTCHA_FIELD)))) {
    return { error: "captchaFailed", values: typed };
  }

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
  // The visitor's CAPTCHA token was spent above (single use), so this
  // server-side sign-in carries a one-time pass instead (see captcha.ts).
  await signIn("credentials", {
    email: d.email,
    password: d.password,
    captchaPass: issueCaptchaPass(),
    redirectTo: `/${locale}/agency`,
  });
  return null;
}
