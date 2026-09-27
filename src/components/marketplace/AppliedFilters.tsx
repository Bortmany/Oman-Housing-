import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localName } from "@/lib/i18nData";
import { formatOMRWhole } from "@/lib/money";
import type { FilterValues } from "./PropertyFilters";

// The filters currently in force, one chip each, with an "x" that reloads the
// search without that one. Server-rendered links, so the whole thing keeps
// working with JavaScript switched off — same as the filter form itself.
export function AppliedFilters({
  values,
  neighborhoods,
}: {
  values: FilterValues;
  neighborhoods: Array<{ slug: string; nameEn: string; nameAr: string }>;
}) {
  const locale = useLocale();
  const t = useTranslations("properties");
  const te = useTranslations("enums");

  const hood = neighborhoods.find((n) => n.slug === values.hood);

  const chips: Array<{ key: keyof FilterValues; label: string }> = [];
  if (hood) {
    chips.push({
      key: "hood",
      label: localName(locale, hood.nameEn, hood.nameAr),
    });
  }
  if (values.type) {
    chips.push({ key: "type", label: te(`propertyType.${values.type}`) });
  }
  if (values.listingType) {
    chips.push({
      key: "listingType",
      label: values.listingType === "SALE" ? t("sale") : t("rent"),
    });
  }
  if (values.minPrice) {
    chips.push({
      key: "minPrice",
      label: t("chipMinPrice", {
        value: formatOMRWhole(values.minPrice, locale),
      }),
    });
  }
  if (values.maxPrice) {
    chips.push({
      key: "maxPrice",
      label: t("chipMaxPrice", {
        value: formatOMRWhole(values.maxPrice, locale),
      }),
    });
  }
  if (values.beds) {
    chips.push({
      key: "beds",
      label: t("bedroomsPlus", { count: Number(values.beds) }),
    });
  }
  if (values.ownership) {
    chips.push({ key: "ownership", label: te(`ownership.${values.ownership}`) });
  }

  if (chips.length === 0) return null;

  // The query string for "everything except this one filter".
  function without(key: keyof FilterValues): Record<string, string> {
    const query: Record<string, string> = {};
    for (const [name, value] of Object.entries(values)) {
      if (name !== key && value) query[name] = String(value);
    }
    return query;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-stone-500 dark:text-stone-400">
        {t("appliedFilters")}
      </span>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={{ pathname: "/properties", query: without(chip.key) }}
          aria-label={t("removeFilter", { name: chip.label })}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800 ring-1 ring-inset ring-teal-600/20 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-400/30 dark:hover:bg-teal-900"
        >
          {chip.label}
          <span aria-hidden="true">×</span>
        </Link>
      ))}
    </div>
  );
}
