"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

// Wraps the admin area. Same plain, bilingual fallback as the app boundary;
// text/direction come from the locale layout, so it reads correctly in RTL.
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-stone-900">{t("title")}</h1>
      <p className="mt-3 text-stone-600">{t("description")}</p>
      <div className="mt-6 flex items-center justify-center">
        <Button onClick={() => unstable_retry()}>{t("tryAgain")}</Button>
      </div>
    </div>
  );
}
