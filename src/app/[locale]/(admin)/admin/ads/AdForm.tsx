"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { AD_SLOTS, AD_SLOT_INFO, isAdSlot } from "@/lib/ads/rules";
import type { AdFormState } from "./actions";

export type AdFormValues = {
  id?: string;
  advertiser: string;
  slot: string;
  neighborhoodId: string;
  linkUrl: string;
  altEn: string;
  altAr: string;
  startsAt: string;
  endsAt: string;
  agreedPrice: string;
};

const inputClass =
  "mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 aria-[invalid=true]:border-rose-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";
const labelClass = "block text-sm font-medium text-stone-800 dark:text-stone-200";
const helpClass = "mt-1 text-xs text-stone-600 rtl:text-sm dark:text-stone-300";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      )}
      {label}
    </Button>
  );
}

export function AdForm({
  action,
  initial,
  neighborhoods,
  editing,
}: {
  action: (prev: AdFormState, fd: FormData) => Promise<AdFormState>;
  initial: AdFormValues;
  neighborhoods: Array<{ id: string; label: string }>;
  editing: boolean;
}) {
  const t = useTranslations("adminAds");
  const [state, formAction] = useActionState(action, { error: null, values: null });
  const v = state.values ?? initial;
  const [slot, setSlot] = useState(initial.slot || "HOME_BAND");
  const currentSlot = isAdSlot(slot) ? slot : "HOME_BAND";
  const perArea = AD_SLOT_INFO[currentSlot].perArea;
  const errorText = state.error ? (t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : t("errors.failed")) : null;
  const bad = (...keys: string[]) => (state.error && keys.includes(state.error) ? true : undefined);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {editing && <input type="hidden" name="id" value={initial.id} />}
      {errorText && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          {errorText}
        </p>
      )}

      <label className={labelClass}>
        {t("form.advertiser")}
        <input name="advertiser" required maxLength={120} defaultValue={v.advertiser} placeholder="Bank Muscat" aria-invalid={bad("required")} className={inputClass} />
      </label>

      <label className={labelClass}>
        {t("form.slot")}
        <select
          name="slot"
          required
          defaultValue={v.slot || "HOME_BAND"}
          onChange={(e) => setSlot(e.target.value)}
          className={inputClass}
        >
          {AD_SLOTS.map((s) => (
            <option key={s} value={s}>{t(`slot.${s}`)}</option>
          ))}
        </select>
        <span className={`block ${helpClass}`}>{t("size", { size: AD_SLOT_INFO[currentSlot].size })}</span>
      </label>

      {perArea && (
        <label className={labelClass}>
          {t("form.neighborhood")}
          <select name="neighborhoodId" required defaultValue={v.neighborhoodId} aria-invalid={bad("neighborhood")} className={inputClass}>
            <option value="" disabled>{t("form.chooseNeighborhood")}</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </label>
      )}

      <label className={labelClass}>
        {t("form.link")}
        <input name="linkUrl" required type="url" inputMode="url" dir="ltr" maxLength={500} defaultValue={v.linkUrl} placeholder="https://www.bankmuscat.com" aria-invalid={bad("link")} className={inputClass} />
        <span className={`block ${helpClass}`}>{t("form.linkHelp")}</span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          {t("form.altEn")}
          <input name="altEn" required maxLength={200} defaultValue={v.altEn} placeholder="Home loans from Bank Muscat" aria-invalid={bad("required")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("form.altAr")}
          <input name="altAr" maxLength={200} dir="rtl" defaultValue={v.altAr} placeholder="قروض سكنية من بنك مسقط" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          {t("form.imageEn")}
          <input name="imageEn" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} aria-invalid={bad("image")} className={`${inputClass} py-2`} />
          {editing && <span className={`block ${helpClass}`}>{t("form.imageKeep")}</span>}
        </label>
        <label className={labelClass}>
          {t("form.imageAr")}
          <input name="imageAr" type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={bad("image")} className={`${inputClass} py-2`} />
          <span className={`block ${helpClass}`}>{t("form.imageArHelp")}</span>
        </label>
      </div>
      <p className={helpClass}>{t("form.imageHelp")}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          {t("form.startsAt")}
          <input name="startsAt" type="datetime-local" required dir="ltr" defaultValue={v.startsAt} aria-invalid={bad("dates")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("form.endsAt")}
          <input name="endsAt" type="datetime-local" required dir="ltr" defaultValue={v.endsAt} aria-invalid={bad("dates")} className={inputClass} />
        </label>
      </div>
      <p className={helpClass}>{t("form.timeNote")}</p>

      <label className={labelClass}>
        {t("form.agreedPrice")}
        <input name="agreedPrice" inputMode="decimal" dir="ltr" maxLength={12} defaultValue={v.agreedPrice} placeholder="60.000" aria-invalid={bad("price")} className={`${inputClass} sm:max-w-xs`} />
        <span className={`block ${helpClass}`}>{t("form.agreedPriceHelp")}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SaveButton label={t("save")} />
        <Link href="/admin/ads" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300">
          {t("form.cancel")}
        </Link>
      </div>
    </form>
  );
}
