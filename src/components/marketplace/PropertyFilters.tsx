import { useLocale, useTranslations } from "next-intl";
import { localName } from "@/lib/i18nData";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;
const OWNERSHIP = ["OMANI_ONLY", "GCC_ELIGIBLE", "FOREIGN_ITC", "UNKNOWN"] as const;

export type FilterValues = {
  hood?: string;
  type?: string;
  listingType?: string;
  minPrice?: string;
  maxPrice?: string;
  beds?: string;
  ownership?: string;
};

// Server component: plain GET form, URL is the state. Submitting reloads
// /properties with the query string — bookmarkable, zero client JS.
export function PropertyFilters({
  neighborhoods,
  values,
}: {
  neighborhoods: Array<{ slug: string; nameEn: string; nameAr: string }>;
  values: FilterValues;
}) {
  const locale = useLocale();
  const t = useTranslations("properties");
  const te = useTranslations("enums");

  return (
    <form
      method="get"
      className="grid grid-cols-2 items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:grid-cols-4 lg:grid-cols-8"
    >
      <div className="col-span-2">
        <Label htmlFor="hood">{t("filterLocation")}</Label>
        <Select id="hood" name="hood" defaultValue={values.hood ?? ""}>
          <option value="">{t("any")}</option>
          {neighborhoods.map((n) => (
            <option key={n.slug} value={n.slug}>
              {localName(locale, n.nameEn, n.nameAr)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="type">{t("filterType")}</Label>
        <Select id="type" name="type" defaultValue={values.type ?? ""}>
          <option value="">{t("any")}</option>
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt} value={pt}>{te(`propertyType.${pt}`)}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="listingType">{t("filterListingType")}</Label>
        <Select id="listingType" name="listingType" defaultValue={values.listingType ?? ""}>
          <option value="">{t("any")}</option>
          <option value="SALE">{t("sale")}</option>
          <option value="RENT">{t("rent")}</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="minPrice">{t("filterMinPrice")}</Label>
        <Input id="minPrice" name="minPrice" type="number" min={0}
          defaultValue={values.minPrice ?? ""} />
      </div>
      <div>
        <Label htmlFor="maxPrice">{t("filterMaxPrice")}</Label>
        <Input id="maxPrice" name="maxPrice" type="number" min={0}
          defaultValue={values.maxPrice ?? ""} />
      </div>
      <div>
        <Label htmlFor="beds">{t("filterBedrooms")}</Label>
        <Select id="beds" name="beds" defaultValue={values.beds ?? ""}>
          <option value="">{t("any")}</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{t("bedroomsPlus", { count: n })}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="ownership">{t("filterOwnership")}</Label>
        <Select id="ownership" name="ownership" defaultValue={values.ownership ?? ""}>
          <option value="">{t("any")}</option>
          {OWNERSHIP.map((o) => (
            <option key={o} value={o}>{te(`ownership.${o}`)}</option>
          ))}
        </Select>
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-4 lg:col-span-8">
        <Button type="submit">{t("applyFilters")}</Button>
        <ButtonLink href="/properties" variant="secondary">
          {t("clearFilters")}
        </ButtonLink>
      </div>
    </form>
  );
}
