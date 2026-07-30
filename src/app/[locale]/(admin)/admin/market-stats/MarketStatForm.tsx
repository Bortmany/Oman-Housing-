"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveMarketStat, type StatFormState } from "./actions";
import { Input, Label, Select, Hint, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { localName } from "@/lib/i18nData";
import { PROVENANCE_VALUES } from "@/lib/provenance";
import { typedOr } from "@/lib/formValues";

export type LocationOptions = {
  governorates: Array<{ id: string; nameEn: string; nameAr: string }>;
  cities: Array<{ id: string; nameEn: string; nameAr: string; governorateId: string }>;
  neighborhoods: Array<{ id: string; nameEn: string; nameAr: string; cityId: string }>;
};

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;

const METRICS = [
  "avgSalePrice", "medianSalePrice", "avgRentMonthly",
  "avgPricePerSqm", "grossYieldPct", "transactionCount", "sampleSize",
] as const;

export function MarketStatForm({ locations }: { locations: LocationOptions }) {
  const t = useTranslations("admin");
  const te = useTranslations("enums");
  const tp = useTranslations("provenance");
  const tm = useTranslations("market");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<StatFormState, FormData>(
    saveMarketStat,
    null,
  );

  // A rejected row comes back as it was typed — no re-keying a whole stat.
  const typed = state?.values;

  return (
    <form action={action}>
      <Card className="space-y-4">
        <div>
          <Label htmlFor="scope">{t("scope")}</Label>
          <Select id="scope" name="scope" required
            defaultValue={typedOr(typed, "scope")}>
            <option value="" disabled>
              —
            </option>
            <option value="national">{t("wholeCountry")}</option>
            <optgroup label={t("governorate")}>
              {locations.governorates.map((g) => (
                <option key={g.id} value={`g:${g.id}`}>
                  {localName(locale, g.nameEn, g.nameAr)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("city")}>
              {locations.cities.map((c) => (
                <option key={c.id} value={`c:${c.id}`}>
                  {localName(locale, c.nameEn, c.nameAr)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("neighborhood")}>
              {locations.neighborhoods.map((n) => (
                <option key={n.id} value={`n:${n.id}`}>
                  {localName(locale, n.nameEn, n.nameAr)}
                </option>
              ))}
            </optgroup>
          </Select>
          <Hint>{t("scopeHint")}</Hint>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="propertyType">{tm("propertyType")}</Label>
            <Select id="propertyType" name="propertyType"
              defaultValue={typedOr(typed, "propertyType")}>
              <option value="">{tm("allTypes")}</option>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {te(`propertyType.${pt}`)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="period">{t("period")}</Label>
            <Input id="period" name="period" type="month" required
              defaultValue={typedOr(typed, "period")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {METRICS.map((m) => (
            <div key={m}>
              <Label htmlFor={m}>{t(`stat.${m}`)}</Label>
              <Input id={m} name={m} type="number" step="any" min={0}
                defaultValue={typedOr(typed, m)} />
            </div>
          ))}
        </div>

        <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="provenance">{t("provenance")}</Label>
            <Select id="provenance" name="provenance" required
              defaultValue={typedOr(typed, "provenance", "USER_SUBMITTED")}>
              {PROVENANCE_VALUES.map((p) => (
                <option key={p} value={p}>
                  {tp(p)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="confidence">{t("confidence")}</Label>
            <Input
              id="confidence"
              name="confidence"
              type="number"
              min={0}
              max={1}
              step={0.05}
              defaultValue={typedOr(typed, "confidence", "0.5")}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sourceNote">{t("sourceNote")}</Label>
            <Input id="sourceNote" name="sourceNote" maxLength={500}
              defaultValue={typedOr(typed, "sourceNote")} />
            <Hint>{t("sourceNoteHint")}</Hint>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sourceUrl">{t("sourceUrl")}</Label>
            <Input id="sourceUrl" name="sourceUrl" type="url" maxLength={500}
              defaultValue={typedOr(typed, "sourceUrl")} />
          </div>
        </div>

        <FieldError>
          {state?.error === "atLeastOneMetric"
            ? t("stat.atLeastOneMetric")
            : state?.error
              ? t("validationFailed")
              : null}
        </FieldError>

        <Button type="submit" disabled={pending}>
          {tCommon("save")}
        </Button>
      </Card>
    </form>
  );
}
