"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { checkRateLimit, getAnonRateLimitKey } from "@/lib/rate-limit";
import { isPossibleEmail } from "@/lib/contact";
import { submittedValues, type SubmittedValues } from "@/lib/formValues";
import { safePath } from "@/lib/safePath";
import { CAPTCHA_FIELD, issueCaptchaPass, verifyCaptcha } from "@/lib/captcha";
import {
  INVITE_ATTEMPT_LIMIT,
  INVITE_CODE_FIELD,
  checkInviteCode,
  getSignupMode,
} from "@/lib/signupMode";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Must look like a real address (name@domain.tld) — re-checked here because
  // the browser check can always be skipped.
  email: z.string().trim().toLowerCase().max(200).refine(isPossibleEmail),
  password: z.string().min(8).max(200),
});

export type RegisterState = {
  error:
    | "emailTaken"
    | "registerFailed"
    | "rateLimited"
    | "captchaFailed"
    | "inviteRequired"
    | "signupClosed";
  // Name and email come back so a failed signup is not retyped. The password
  // is never carried back.
  values?: SubmittedValues;
} | null;

/** The boxes handed back when signing up fails — never the password. */
const REGISTER_FIELDS = ["name", "email"] as const;

export async function registerUser(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const typed = submittedValues(formData, REGISTER_FIELDS);

  // Throttle signups per visitor (real IP when trusted, otherwise a stable
  // per-browser cookie — see getAnonRateLimitKey) so no one can bulk-create
  // accounts.
  const anonKey = await getAnonRateLimitKey();
  const { allowed } = checkRateLimit(`register:ip:${anonKey}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) return { error: "rateLimited", values: typed };

  // Invitation-only gate (src/lib/signupMode.ts). Checked before the CAPTCHA
  // so a wrong code never burns a single-use CAPTCHA token for nothing.
  const mode = getSignupMode();
  if (mode === "closed") return { error: "signupClosed", values: typed };
  if (mode === "invite" && !checkInviteCode(formData.get(INVITE_CODE_FIELD))) {
    // Only FAILED code attempts count here; the register limiter above
    // already bounds total submissions. Never echo the code back.
    const attempt = checkRateLimit(`invitecode:ip:${anonKey}`, INVITE_ATTEMPT_LIMIT);
    return { error: attempt.allowed ? "inviteRequired" : "rateLimited", values: typed };
  }

  // Dormant CAPTCHA (src/lib/captcha.ts) — always passes until keyed.
  if (!(await verifyCaptcha(formData.get(CAPTCHA_FIELD)))) {
    return { error: "captchaFailed", values: typed };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "registerFailed", values: typed };

  const { name, email, password } = parsed.data;
  const locale = await getLocale();
  const callbackUrl = safePath(formData.get("callbackUrl"), "/account");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "emailTaken", values: typed };

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      locale,
    },
  });

  // Signs the new user in and redirects (throws a redirect internally).
  // The visitor's CAPTCHA token was spent above (single use), so this
  // server-side sign-in carries a one-time pass instead (see captcha.ts).
  await signIn("credentials", {
    email,
    password,
    captchaPass: issueCaptchaPass(),
    redirectTo: `/${locale}${callbackUrl}`,
  });
  return null;
}
