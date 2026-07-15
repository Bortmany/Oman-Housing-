"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

// Wraps the signed-in area. Shows a plain, bilingual "something went wrong"
// (text/direction come from the locale layout, so it reads correctly in RTL).
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Client-side error boundary — record it for debugging. When Sentry is
    // configured it also captures this automatically via its instrumentation.
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
