"use client";

// Contact inputs shared by every form that asks for a phone or an email:
// greyed-out example in the box, a country-code dropdown pre-set to Oman, and
// the "can this even exist?" check run while the user is still on the form.
// The same rules run again in the server actions (src/lib/contact.ts).

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Select, Label, Hint, FieldError } from "@/components/ui/Field";
import {
  DIAL_CODES,
  checkPhone,
  isPossibleEmail,
  phoneExample,
  splitPhone,
} from "@/lib/contact";

// ---------- Phone ----------

export function usePhoneField(stored?: string | null) {
  const initial = splitPhone(stored ?? null);
  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [number, setNumber] = useState(initial.number);
  const [touched, setTouched] = useState(false);
  return {
    dialCode,
    setDialCode,
    number,
    setNumber,
    touched,
    setTouched,
    problem: checkPhone(dialCode, number),
  };
}

export type PhoneFieldState = ReturnType<typeof usePhoneField>;

export function PhoneField({
  id,
  name = "phone",
  codeName,
  label,
  field,
  hint,
  required,
  disabled,
  serverError,
}: {
  id: string;
  name?: string;
  codeName?: string;
  label: string;
  field: PhoneFieldState;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  serverError?: boolean;
}) {
  const t = useTranslations("contact");
  const showError = (field.touched && field.problem !== null) || !!serverError;
  const message =
    field.problem === "digits"
      ? t("errors.phoneDigits")
      : field.problem === "tooShort"
        ? t("errors.phoneTooShort", { code: field.dialCode })
        : field.problem === "tooLong"
          ? t("errors.phoneTooLong", { code: field.dialCode })
          : field.problem === "mobilePrefix"
            ? t("errors.phoneMobilePrefix")
            : field.problem === "unknownCode"
              ? t("errors.phoneCode")
              : null;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {/* A dial code and its digits are one left-to-right expression, so this
          pair stays LTR even in Arabic — same reasoning as the charts. */}
      <div dir="ltr" className="flex gap-2">
        <div className="w-36 shrink-0">
          <Select
            id={`${id}-code`}
            name={codeName ?? `${name}Code`}
            aria-label={t("countryCode")}
            value={field.dialCode}
            onChange={(e) => field.setDialCode(e.target.value)}
            disabled={disabled}
            error={showError}
          >
            {DIAL_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {t(`countries.${c.key}`)} {c.code}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            id={id}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={24}
            placeholder={t("examples.phone", {
              example: phoneExample(field.dialCode),
            })}
            value={field.number}
            onChange={(e) => field.setNumber(e.target.value)}
            onBlur={() => field.setTouched(true)}
            required={required}
            disabled={disabled}
            error={showError}
          />
        </div>
      </div>
      {hint && !(field.touched && message) ? <Hint>{hint}</Hint> : null}
      <FieldError>{field.touched ? message : null}</FieldError>
    </div>
  );
}

// ---------- Email ----------

export function useEmailField(initial = "") {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  return {
    value,
    setValue,
    touched,
    setTouched,
    // Empty is not this field's problem — `required` and the server handle that.
    problem: trimmed === "" || isPossibleEmail(trimmed) ? null : "shape",
  };
}

export type EmailFieldState = ReturnType<typeof useEmailField>;

export function EmailField({
  id,
  name = "email",
  label,
  field,
  hint,
  required,
  disabled,
  serverError,
}: {
  id: string;
  name?: string;
  label: string;
  field: EmailFieldState;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  serverError?: boolean;
}) {
  const t = useTranslations("contact");
  const showError = (field.touched && field.problem !== null) || !!serverError;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="email"
        // Addresses read left-to-right in both languages.
        dir="ltr"
        inputMode="email"
        autoComplete="email"
        maxLength={200}
        placeholder={t("examples.email")}
        value={field.value}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => field.setTouched(true)}
        required={required}
        disabled={disabled}
        error={showError}
      />
      {hint && !(field.touched && field.problem) ? <Hint>{hint}</Hint> : null}
      <FieldError>
        {field.touched && field.problem ? t("errors.email") : null}
      </FieldError>
    </div>
  );
}

/**
 * One guard for a form's submit: stops the server action when a contact field
 * holds something impossible, and lights up the fields that need fixing.
 */
export function blockImpossibleSubmit(
  event: React.FormEvent<HTMLFormElement>,
  fields: Array<{ problem: string | null; setTouched: (v: boolean) => void }>,
) {
  const bad = fields.filter((f) => f.problem !== null);
  if (bad.length === 0) return;
  event.preventDefault();
  for (const f of bad) f.setTouched(true);
}
