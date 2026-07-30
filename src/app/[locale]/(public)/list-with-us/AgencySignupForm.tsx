"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signUpAgency, type AgencySignupState } from "./actions";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import {
  EmailField,
  PhoneField,
  blockImpossibleSubmit,
  useEmailField,
  usePhoneField,
} from "@/components/ui/ContactFields";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AgencySignupForm() {
  const t = useTranslations("agency");
  const tc = useTranslations("contact");
  const [state, action, pending] = useActionState<AgencySignupState, FormData>(
    signUpAgency,
    null,
  );
  const email = useEmailField();
  const phone = usePhoneField();

  // Ring the specific box that failed, alongside the message text below.
  const invalid = (name: string) =>
    state?.error === "signupFailed" && state.field === name;

  return (
    <form noValidate
      action={action}
      onSubmit={(e) => blockImpossibleSubmit(e, [email, phone])}
    >
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="agencyNameEn">{t("signup.nameEn")}</Label>
            <Input
              id="agencyNameEn"
              name="agencyNameEn"
              placeholder={t("signup.nameEnExample")}
              required
              maxLength={120}
              disabled={pending}
              error={invalid("agencyNameEn")}
            />
          </div>
          <div>
            <Label htmlFor="agencyNameAr">{t("signup.nameAr")}</Label>
            <Input
              id="agencyNameAr"
              name="agencyNameAr"
              dir="rtl"
              placeholder={t("signup.nameArExample")}
              maxLength={120}
              disabled={pending}
              error={invalid("agencyNameAr")}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="licenseNo">{t("signup.licenseNo")}</Label>
            <Input
              id="licenseNo"
              name="licenseNo"
              placeholder={t("signup.licenseExample")}
              maxLength={60}
              disabled={pending}
              error={invalid("licenseNo")}
            />
            <Hint>{t("signup.licenseHint")}</Hint>
          </div>
          <PhoneField
            id="phone"
            label={t("signup.phone")}
            field={phone}
            disabled={pending}
            serverError={invalid("phone")}
          />
        </div>

        <div className="border-t border-stone-200 pt-4">
          <p className="text-sm font-medium text-stone-700">{t("signup.loginSection")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contactName">{t("signup.contactName")}</Label>
              <Input
                id="contactName"
                name="contactName"
                placeholder={tc("examples.name")}
                required
                maxLength={100}
                disabled={pending}
                error={invalid("contactName")}
              />
            </div>
            <EmailField
              id="email"
              label={t("signup.email")}
              field={email}
              required
              disabled={pending}
              serverError={state?.error === "emailTaken" || invalid("email")}
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="password">{t("signup.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              disabled={pending}
              error={invalid("password")}
            />
            <Hint>{t("signup.passwordHint")}</Hint>
          </div>
        </div>

        <FieldError>
          {state?.error === "emailTaken"
            ? t("signup.emailTaken")
            : state?.error
              ? t("signup.failed")
              : null}
        </FieldError>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </Card>
    </form>
  );
}
