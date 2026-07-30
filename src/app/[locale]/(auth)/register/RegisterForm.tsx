"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { registerUser, type RegisterState } from "./actions";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import {
  EmailField,
  blockImpossibleSubmit,
  useEmailField,
} from "@/components/ui/ContactFields";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("contact");
  const email = useEmailField();
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
    <form
      action={action}
      onSubmit={(e) => blockImpossibleSubmit(e, [email])}
      className="space-y-4"
    >
      {callbackUrl && (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      )}
      <div>
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          name="name"
          placeholder={tc("examples.name")}
          required
          maxLength={100}
          disabled={pending}
        />
      </div>
      <EmailField
        id="email"
        label={t("email")}
        field={email}
        required
        disabled={pending}
        serverError={state?.error === "emailTaken"}
      />
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          disabled={pending}
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
