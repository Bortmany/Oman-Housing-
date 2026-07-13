"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { registerUser, type RegisterState } from "./actions";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const t = useTranslations("auth");
  const rawCallback = useSearchParams().get("callbackUrl");
  const callbackUrl =
    rawCallback?.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "";
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerUser,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {callbackUrl && (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      )}
      <div>
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={100} />
      </div>
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
        />
        <Hint>{t("passwordHint")}</Hint>
      </div>
      <FieldError>{state?.error ? t(state.error) : null}</FieldError>
      <Button type="submit" disabled={pending} className="w-full">
        {t("register")}
      </Button>
    </form>
  );
}
