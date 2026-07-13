"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAgencyProfile, type AgencyProfileState } from "../actions";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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

  return (
    <form action={action}>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nameEn">{t("signup.nameEn")}</Label>
            <Input id="nameEn" name="nameEn" required maxLength={120}
              defaultValue={defaults.nameEn} />
          </div>
          <div>
            <Label htmlFor="nameAr">{t("signup.nameAr")}</Label>
            <Input id="nameAr" name="nameAr" dir="rtl" maxLength={120}
              defaultValue={defaults.nameAr ?? ""} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="licenseNo">{t("signup.licenseNo")}</Label>
            <Input id="licenseNo" name="licenseNo" maxLength={60}
              defaultValue={defaults.licenseNo ?? ""} />
          </div>
          <div>
            <Label htmlFor="email">{t("signup.email")}</Label>
            <Input id="email" name="email" type="email" maxLength={200}
              defaultValue={defaults.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">{t("signup.phone")}</Label>
            <Input id="phone" name="phone" maxLength={40}
              defaultValue={defaults.phone ?? ""} />
          </div>
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
