"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { safePath } from "@/lib/safePath";
import { Turnstile } from "@/components/ui/Turnstile";

export function LoginForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("contact");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safePath(searchParams.get("callbackUrl"), "/account");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Bumped after every failed attempt so the (dormant) CAPTCHA widget hands
  // out a fresh token — each one is single use.
  const [attempt, setAttempt] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      // Filled in by the Turnstile widget when the CAPTCHA is switched on;
      // absent (and ignored server-side) while it is dormant.
      captchaToken: form.get("cf-turnstile-response") ?? "",
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setAttempt((n) => n + 1);
      setError(
        result.code === "captcha" ? t("captchaFailed") : t("invalidCredentials"),
      );
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        {/* Addresses read left-to-right in both languages. */}
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder={tc("examples.email")}
          required
          disabled={pending}
        />
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          disabled={pending}
        />
      </div>
      <Turnstile resetKey={attempt} />
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={pending} className="w-full">
        {t("signIn")}
      </Button>
    </form>
  );
}
