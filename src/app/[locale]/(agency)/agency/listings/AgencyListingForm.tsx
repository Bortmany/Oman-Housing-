"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  submitAgencyListing,
  type AgencyListingState,
} from "../actions";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { localName } from "@/lib/i18nData";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;
const OWNERSHIP = ["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"] as const;

export function AgencyListingForm({
  neighborhoods,
}: {
  neighborhoods: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    city: { nameEn: string; nameAr: string };
  }>;
}) {
  const t = useTranslations("agency");
  const ta = useTranslations("admin");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AgencyListingState, FormData>(
    submitAgencyListing,
    null,
  );
  const [listingType, setListingType] = useState("SALE");

  // Ring the specific box that failed, alongside the message text below.
  const invalid = (name: string) =>
    state?.error === "validationFailed" && state.field === name;

  return (
    <form noValidate action={action}>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="titleEn">{ta("property.titleEn")}</Label>
            <Input id="titleEn" name="titleEn" required maxLength={200}
              placeholder={ta("examples.titleEn")} disabled={pending}
              error={invalid("titleEn")} />
          </div>
          <div>
            <Label htmlFor="titleAr">{ta("property.titleAr")}</Label>
            <Input id="titleAr" name="titleAr" dir="rtl" maxLength={200}
              placeholder={ta("examples.titleAr")} disabled={pending}
              error={invalid("titleAr")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="neighborhoodId">{ta("neighborhood")}</Label>
            <Select id="neighborhoodId" name="neighborhoodId" required defaultValue=""
              disabled={pending} error={invalid("neighborhoodId")}>
              <option value="" disabled>—</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {localName(locale, n.city.nameEn, n.city.nameAr)} —{" "}
                  {localName(locale, n.nameEn, n.nameAr)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="type">{ta("property.type")}</Label>
            <Select id="type" name="type" required defaultValue="APARTMENT" disabled={pending}>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>{te(`propertyType.${pt}`)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ownership">{ta("property.ownership")}</Label>
            <Select id="ownership" name="ownership" required defaultValue="UNKNOWN" disabled={pending}>
              {OWNERSHIP.map((o) => (
                <option key={o} value={o}>{te(`ownership.${o}`)}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="bedrooms">{ta("property.bedrooms")}</Label>
            <Input id="bedrooms" name="bedrooms" type="number" min={0}
              placeholder={ta("examples.bedrooms")} disabled={pending}
              error={invalid("bedrooms")} />
          </div>
          <div>
            <Label htmlFor="bathrooms">{ta("property.bathrooms")}</Label>
            <Input id="bathrooms" name="bathrooms" type="number" min={0}
              placeholder={ta("examples.bathrooms")} disabled={pending}
              error={invalid("bathrooms")} />
          </div>
          <div>
            <Label htmlFor="areaSqm">{ta("property.areaSqm")}</Label>
            <Input id="areaSqm" name="areaSqm" type="number" step="any" min={0}
              placeholder={ta("examples.areaSqm")} disabled={pending}
              error={invalid("areaSqm")} />
          </div>
          <div>
            <Label htmlFor="yearBuilt">{ta("property.yearBuilt")}</Label>
            <Input id="yearBuilt" name="yearBuilt" type="number" min={1900} max={2100}
              placeholder={ta("examples.yearBuilt")} disabled={pending}
              error={invalid("yearBuilt")} />
          </div>
        </div>

        {/* Listing (price) */}
        <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="listingType">{ta("listing.listingType")}</Label>
            <Select
              id="listingType"
              name="listingType"
              value={listingType}
              onChange={(e) => setListingType(e.target.value)}
              disabled={pending}
            >
              <option value="SALE">{t("listings.sale")}</option>
              <option value="RENT">{t("listings.rent")}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="price">{ta("listing.price")}</Label>
            <Input id="price" name="price" type="number" step="any" min={0} required
              placeholder={ta("examples.price")} disabled={pending}
              error={invalid("price")} />
          </div>
          {listingType === "RENT" && (
            <div>
              <Label htmlFor="rentPeriod">{ta("listing.rentPeriod")}</Label>
              <Select id="rentPeriod" name="rentPeriod" defaultValue="MONTHLY" disabled={pending}>
                <option value="MONTHLY">{te("rentPeriod.MONTHLY")}</option>
                <option value="ANNUAL">{te("rentPeriod.ANNUAL")}</option>
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="descriptionEn">{ta("property.descriptionEn")}</Label>
            <Textarea id="descriptionEn" name="descriptionEn" maxLength={5000}
              placeholder={ta("examples.descriptionEn")} disabled={pending}
              error={invalid("descriptionEn")} />
          </div>
          <div>
            <Label htmlFor="descriptionAr">{ta("property.descriptionAr")}</Label>
            <Textarea id="descriptionAr" name="descriptionAr" dir="rtl" maxLength={5000}
              placeholder={ta("examples.descriptionAr")} disabled={pending}
              error={invalid("descriptionAr")} />
          </div>
        </div>

        <FieldError>
          {state?.error === "atListingLimit"
            ? t("listings.atLimit")
            : state?.error === "notAllowed"
              ? t("listings.notAllowed")
              : state?.error
                ? t("listings.validationFailed")
                : null}
        </FieldError>

        <p className="text-xs text-stone-500">{t("listings.submitNotice")}</p>
        <Button type="submit" disabled={pending}>
          {pending ? tc("save") : t("listings.submit")}
        </Button>
      </Card>
    </form>
  );
}
