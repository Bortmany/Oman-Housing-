"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveProperty, type PropertyFormState } from "./actions";
import { Input, Label, Select, Textarea, Hint, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { localName } from "@/lib/i18nData";
import { PROVENANCE_VALUES } from "@/lib/provenance";
import { typedOr } from "@/lib/formValues";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;
const OWNERSHIP = ["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"] as const;

export type PropertyDefaults = {
  id?: string;
  neighborhoodId?: string;
  type?: string;
  ownership?: string;
  titleEn?: string;
  titleAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: string | null;
  plotSqm?: string | null;
  yearBuilt?: number | null;
  furnished?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  provenance?: string;
  confidence?: number;
  sourceNote?: string | null;
};

export function PropertyForm({
  neighborhoods,
  defaults = {},
}: {
  neighborhoods: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    city: { nameEn: string; nameAr: string };
  }>;
  defaults?: PropertyDefaults;
}) {
  const t = useTranslations("admin");
  const te = useTranslations("enums");
  const tp = useTranslations("provenance");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<PropertyFormState, FormData>(
    saveProperty,
    null,
  );

  // A rejected save comes back with the edits in the boxes, not the old values.
  // Any photos picked for upload do have to be chosen again — the browser
  // clears its own file picker and no site can refill it.
  const typed = state?.values;

  return (
    <form action={action}>
      <Card className="space-y-4">
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="titleEn">{t("property.titleEn")}</Label>
            <Input id="titleEn" name="titleEn" required maxLength={200}
              defaultValue={typedOr(typed, "titleEn", defaults.titleEn ?? "")} />
          </div>
          <div>
            <Label htmlFor="titleAr">{t("property.titleAr")}</Label>
            <Input id="titleAr" name="titleAr" dir="rtl" maxLength={200}
              defaultValue={typedOr(typed, "titleAr", defaults.titleAr ?? "")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="neighborhoodId">{t("neighborhood")}</Label>
            <Select id="neighborhoodId" name="neighborhoodId" required
              defaultValue={typedOr(typed, "neighborhoodId", defaults.neighborhoodId ?? "")}>
              <option value="" disabled>—</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {localName(locale, n.city.nameEn, n.city.nameAr)} — {localName(locale, n.nameEn, n.nameAr)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="type">{t("property.type")}</Label>
            <Select id="type" name="type" required defaultValue={typedOr(typed, "type", defaults.type ?? "APARTMENT")}>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>{te(`propertyType.${pt}`)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ownership">{t("property.ownership")}</Label>
            <Select id="ownership" name="ownership" required
              defaultValue={typedOr(typed, "ownership", defaults.ownership ?? "UNKNOWN")}>
              {OWNERSHIP.map((o) => (
                <option key={o} value={o}>{te(`ownership.${o}`)}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="bedrooms">{t("property.bedrooms")}</Label>
            <Input id="bedrooms" name="bedrooms" type="number" min={0}
              defaultValue={typedOr(typed, "bedrooms", String(defaults.bedrooms ?? ""))} />
          </div>
          <div>
            <Label htmlFor="bathrooms">{t("property.bathrooms")}</Label>
            <Input id="bathrooms" name="bathrooms" type="number" min={0}
              defaultValue={typedOr(typed, "bathrooms", String(defaults.bathrooms ?? ""))} />
          </div>
          <div>
            <Label htmlFor="areaSqm">{t("property.areaSqm")}</Label>
            <Input id="areaSqm" name="areaSqm" type="number" step="any" min={0}
              defaultValue={typedOr(typed, "areaSqm", defaults.areaSqm ?? "")} />
          </div>
          <div>
            <Label htmlFor="plotSqm">{t("property.plotSqm")}</Label>
            <Input id="plotSqm" name="plotSqm" type="number" step="any" min={0}
              defaultValue={typedOr(typed, "plotSqm", defaults.plotSqm ?? "")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="yearBuilt">{t("property.yearBuilt")}</Label>
            <Input id="yearBuilt" name="yearBuilt" type="number" min={1900} max={2100}
              defaultValue={typedOr(typed, "yearBuilt", String(defaults.yearBuilt ?? ""))} />
          </div>
          <div>
            <Label htmlFor="lat">{t("property.lat")}</Label>
            <Input id="lat" name="lat" type="number" step="any"
              defaultValue={typedOr(typed, "lat", String(defaults.lat ?? ""))} />
          </div>
          <div>
            <Label htmlFor="lng">{t("property.lng")}</Label>
            <Input id="lng" name="lng" type="number" step="any"
              defaultValue={typedOr(typed, "lng", String(defaults.lng ?? ""))} />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <input id="furnished" name="furnished" type="checkbox"
              defaultChecked={typed ? typed.furnished === "on" : (defaults.furnished ?? false)}
              className="size-4 rounded border-stone-300 text-teal-800" />
            <Label htmlFor="furnished" className="!mb-0">
              {t("property.furnished")}
            </Label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="descriptionEn">{t("property.descriptionEn")}</Label>
            <Textarea id="descriptionEn" name="descriptionEn" maxLength={5000}
              defaultValue={typedOr(typed, "descriptionEn", defaults.descriptionEn ?? "")} />
          </div>
          <div>
            <Label htmlFor="descriptionAr">{t("property.descriptionAr")}</Label>
            <Textarea id="descriptionAr" name="descriptionAr" dir="rtl" maxLength={5000}
              defaultValue={typedOr(typed, "descriptionAr", defaults.descriptionAr ?? "")} />
          </div>
        </div>

        <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="provenance">{t("provenance")}</Label>
            <Select id="provenance" name="provenance" required
              defaultValue={typedOr(typed, "provenance", defaults.provenance ?? "USER_SUBMITTED")}>
              {PROVENANCE_VALUES.map((p) => (
                <option key={p} value={p}>{tp(p)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="confidence">{t("confidence")}</Label>
            <Input id="confidence" name="confidence" type="number"
              min={0} max={1} step={0.05} required
              defaultValue={typedOr(typed, "confidence", String(defaults.confidence ?? 0.5))} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sourceNote">{t("sourceNote")}</Label>
            <Input id="sourceNote" name="sourceNote" maxLength={500}
              defaultValue={typedOr(typed, "sourceNote", defaults.sourceNote ?? "")} />
          </div>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <Label htmlFor="images">{t("property.addImages")}</Label>
          <input
            id="images"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="block w-full text-sm text-stone-600 file:me-3 file:rounded-lg file:border-0 file:bg-teal-800 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700"
          />
          <Hint>
            {t("property.imageTooLarge")} {t("property.imageWrongType")}
          </Hint>
        </div>

        <FieldError>
          {state?.error === "imageTooLarge"
            ? t("property.imageTooLarge")
            : state?.error === "imageWrongType"
              ? t("property.imageWrongType")
              : state?.error
                ? t("validationFailed")
                : null}
        </FieldError>

        <Button type="submit" disabled={pending}>
          {tc("save")}
        </Button>
      </Card>
    </form>
  );
}
