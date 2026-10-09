import { useTranslations } from "next-intl";

/**
 * The visible "Featured · مميز" tag on a paid placement. Always real text
 * (never colour or an icon alone), shown in both languages on every page, so
 * a buyer always knows this spot was paid for. It sits over the photo's
 * top-start corner and changes nothing else about the card.
 */
export function FeaturedLabel({ className = "" }: { className?: string }) {
  const t = useTranslations("featured");
  return (
    <span
      className={`rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm ring-1 ring-inset ring-amber-700/40 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/50 ${className}`}
    >
      {t("label")}
    </span>
  );
}
