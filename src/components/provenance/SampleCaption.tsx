import { useTranslations } from "next-intl";

// A one-line visible note for sample figures on a card that is itself a link.
// The sample badge's hint opens on hover or keyboard focus, and a badge inside
// a link is not focusable (the link is the tab stop) — so on a phone a tap
// would just follow the link. This caption says the same thing in plain view,
// with no focusable element inside the link.
export function SampleCaption({ className = "" }: { className?: string }) {
  const t = useTranslations("provenance");
  return (
    <p className={`text-xs text-stone-500 rtl:text-sm dark:text-stone-400 ${className}`}>
      {t("sampleCaption")}
    </p>
  );
}
