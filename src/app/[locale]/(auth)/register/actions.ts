"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export type RegisterState = { error: "emailTaken" | "registerFailed" } | null;

/** Only relative in-app paths — never an absolute URL (open-redirect guard). */
function safePath(raw: unknown, fallback: string): string {
  const s = String(raw ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function registerUser(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "registerFailed" };

  const { name, email, password } = parsed.data;
  const locale = await getLocale();
  const callbackUrl = safePath(formData.get("callbackUrl"), "/account");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "emailTaken" };

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      locale,
    },
  });

  // Signs the new user in and redirects (throws a redirect internally).
  await signIn("credentials", {
    email,
    password,
    redirectTo: `/${locale}${callbackUrl}`,
  });
  return null;
}
