"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveListing, type ListingFormState } from "./actions";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { localName } from "@/lib/i18nData";
import { PROVENANCE_VALUES } from "@/lib/provenance";

export type ListingDefaults = {
  id?: string;
  propertyId?: string;
  listingType?: string;
  price?: string;
  rentPeriod?: string | null;
  provenance?: string;
  confidence?: number;
};

export function ListingForm({
  properties,
  defaults = {},
}: {
  properties: Array<{ id: string; titleEn: string; titleAr: string | null }>;
  defaults?: ListingDefaults;
}) {
  const t = useTranslations("admin");
  const tp = useTranslations("properties");
  const tpr = useTranslations("provenance");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ListingFormState, FormData>(
    saveListing,
    null,
  );
  const [listingType, setListingType] = useState(defaults.listingType ?? "SALE");

  return (
    <form action={action}>
      <Card className="space-y-4">
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

        <div>
          <Label htmlFor="propertyId">{t("listing.property")}</Label>
          <Select id="propertyId" name="propertyId" required
            defaultValue={defaults.propertyId ?? ""}>
            <option value="" disabled>—</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {localName(locale, p.titleEn, p.titleAr)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="listingType">{t("listing.listingType")}</Label>
            <Select id="listingType" name="listingType" required
              value={listingType}
              onChange={(e) => setListingType(e.target.value)}>
              <option value="SALE">{tp("sale")}</option>
              <option value="RENT">{tp("rent")}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="price">{t("listing.price")}</Label>
            <Input id="price" name="price" type="number" step="any" min={0} required
              defaultValue={defaults.price ?? ""} />
          </div>
          {listingType === "RENT" && (
            <div>
              <Label htmlFor="rentPeriod">{t("listing.rentPeriod")}</Label>
              <Select id="rentPeriod" name="rentPeriod"
                defaultValue={defaults.rentPeriod ?? "MONTHLY"}>
                <option value="MONTHLY">{te("rentPeriod.MONTHLY")}</option>
                <option value="ANNUAL">{te("rentPeriod.ANNUAL")}</option>
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="provenance">{t("provenance")}</Label>
            <Select id="provenance" name="provenance" required
              defaultValue={defaults.provenance ?? "USER_SUBMITTED"}>
              {PROVENANCE_VALUES.map((p) => (
                <option key={p} value={p}>{tpr(p)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="confidence">{t("confidence")}</Label>
            <Input id="confidence" name="confidence" type="number"
              min={0} max={1} step={0.05} required
              defaultValue={defaults.confidence ?? 0.5} />
          </div>
        </div>

        <FieldError>{state?.error ? t("validationFailed") : null}</FieldError>

        <Button type="submit" disabled={pending}>{tc("save")}</Button>
      </Card>
    </form>
  );
}
