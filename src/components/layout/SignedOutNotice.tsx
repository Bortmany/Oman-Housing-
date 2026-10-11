"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

// The small "Signed out." note shown once after sign-out (the page address
// carries ?signedOut=1). It tidies the address and fades after a few seconds.
export function SignedOutNotice() {
  const t = useTranslations("nav");
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const flagged = params.get("signedOut") === "1";
  // The page opens with the flag already in its address, so it can start shown.
  const [show, setShow] = useState(flagged);

  useEffect(() => {
    if (flagged) router.replace(pathname);
  }, [flagged, pathname, router]);

  // Separate effect so tidying the address (which clears the flag) doesn't cancel the timer.
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-4 bottom-4 z-30 mx-auto w-fit rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
    >
      {t("signedOut")}
    </p>
  );
}
