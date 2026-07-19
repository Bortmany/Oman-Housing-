"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Tooltip } from "@/components/ui/Tooltip";

// Switches between English and Arabic while staying on the same page.
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";

  function switchLocale() {
    const query = Object.fromEntries(searchParams.entries());
    router.replace({ pathname, query }, { locale: other });
  }

  // The hint is written in the language you would switch TO, on purpose —
  // it has to be readable by someone who can't read the current language.
  const hint = other === "ar" ? "التبديل إلى العربية" : "Switch to English";

  return (
    <Tooltip label={hint} side="bottom">
      <button
        type="button"
        onClick={switchLocale}
        className="rounded-lg px-2 py-1 text-sm font-semibold text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100"
        aria-label={hint}
      >
        {other === "ar" ? "العربية" : "EN"}
      </button>
    </Tooltip>
  );
}
