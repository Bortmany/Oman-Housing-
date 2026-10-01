"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** A green outcome notice that can be closed, and that removes ?submitted=1 from the address so a refresh doesn't repeat it. */
export function DismissibleNotice({ children }: { children: React.ReactNode }) {
  const t = useTranslations("owner.list");
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("submitted")) {
      url.searchParams.delete("submitted");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);
  if (!open) return null;
  return (
    <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100">
      <p>{children}</p>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={() => setOpen(false)}
        className="-m-3 inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 dark:hover:bg-emerald-900"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
