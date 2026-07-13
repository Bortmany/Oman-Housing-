"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signUpAgency, type AgencySignupState } from "./actions";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AgencySignupForm() {
  const t = useTranslations("agency");
  const [state, action, pending] = useActionState<AgencySignupState, FormData>(
    signUpAgency,
    null,
  );

  return (
    <form action={action}>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="agencyNameEn">{t("signup.nameEn")}</Label>
            <Input id="agencyNameEn" name="agencyNameEn" required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="agencyNameAr">{t("signup.nameAr")}</Label>
            <Input id="agencyNameAr" name="agencyNameAr" dir="rtl" maxLength={120} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="licenseNo">{t("signup.licenseNo")}</Label>
            <Input id="licenseNo" name="licenseNo" maxLength={60} />
            <Hint>{t("signup.licenseHint")}</Hint>
          </div>
          <div>
            <Label htmlFor="phone">{t("signup.phone")}</Label>
            <Input id="phone" name="phone" maxLength={40} />
          </div>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <p className="text-sm font-medium text-stone-700">{t("signup.loginSection")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contactName">{t("signup.contactName")}</Label>
              <Input id="contactName" name="contactName" required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="email">{t("signup.email")}</Label>
              <Input id="email" name="email" type="email" required maxLength={200} />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="password">{t("signup.password")}</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
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
