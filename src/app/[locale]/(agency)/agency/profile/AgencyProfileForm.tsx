"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAgencyProfile, type AgencyProfileState } from "../actions";
import { Input, Label, FieldError } from "@/components/ui/Field";
import {
  EmailField,
  PhoneField,
  blockImpossibleSubmit,
  useEmailField,
  usePhoneField,
} from "@/components/ui/ContactFields";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { typedOr } from "@/lib/formValues";

export type AgencyProfileDefaults = {
  nameEn: string;
  nameAr: string | null;
  licenseNo: string | null;
  email: string | null;
  phone: string | null;
};

export function AgencyProfileForm({ defaults }: { defaults: AgencyProfileDefaults }) {
  const t = useTranslations("agency");
  const [state, action, pending] = useActionState<AgencyProfileState, FormData>(
    saveAgencyProfile,
    null,
  );
  const email = useEmailField(defaults.email ?? "");
  // Splits a stored "+968 91234567" back into the dropdown and the box.
  const phone = usePhoneField(defaults.phone);

  // A rejected save comes back with the edits still in the boxes, not the old
  // saved values. (Email and phone hold their own text in React state.)
  const typed = state?.status === "error" ? state.values : undefined;

  return (
    <form noValidate
      action={action}
      onSubmit={(e) => blockImpossibleSubmit(e, [email, phone])}
    >
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nameEn">{t("signup.nameEn")}</Label>
            <Input id="nameEn" name="nameEn" required maxLength={120}
              placeholder={t("signup.nameEnExample")}
              disabled={pending}
              defaultValue={typedOr(typed, "nameEn", defaults.nameEn)} />
          </div>
          <div>
            <Label htmlFor="nameAr">{t("signup.nameAr")}</Label>
            <Input id="nameAr" name="nameAr" dir="rtl" maxLength={120}
              placeholder={t("signup.nameArExample")}
              disabled={pending}
              defaultValue={typedOr(typed, "nameAr", defaults.nameAr ?? "")} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="licenseNo">{t("signup.licenseNo")}</Label>
            <Input id="licenseNo" name="licenseNo" maxLength={60}
              placeholder={t("signup.licenseExample")}
              disabled={pending}
              defaultValue={typedOr(typed, "licenseNo", defaults.licenseNo ?? "")} />
          </div>
          <EmailField
            id="email"
            label={t("signup.email")}
            field={email}
            disabled={pending}
            serverError={state?.status === "error" && state.field === "email"}
          />
          <PhoneField
            id="phone"
            label={t("signup.phone")}
            field={phone}
            disabled={pending}
            serverError={state?.status === "error" && state.field === "phone"}
          />
        </div>

        {state?.status === "saved" && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {t("profile.saved")}
          </p>
        )}
        <FieldError>{state?.status === "error" ? t("profile.failed") : null}</FieldError>

        <Button type="submit" disabled={pending}>{t("profile.save")}</Button>
      </Card>
    </form>
  );
}
