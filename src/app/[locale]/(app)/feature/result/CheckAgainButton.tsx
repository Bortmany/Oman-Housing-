"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { checkFeaturedPayment } from "../actions";

/** "Check again": a rate-limited server-side lookup with the gateway, then the page re-reads our database. */
export function CheckAgainButton({
  paymentId,
  label,
  workingLabel,
  rateLimited,
  failed,
}: {
  paymentId: string;
  label: string;
  workingLabel: string;
  rateLimited: string;
  failed: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const check = () => {
    setError(null);
    startTransition(async () => {
      const res = await checkFeaturedPayment(paymentId);
      if (!res.ok) {
        setError(res.error === "rateLimited" ? rateLimited : failed);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" className="w-full" disabled={pending} aria-busy={pending} onClick={check}>
        {pending ? workingLabel : label}
      </Button>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          {error}
        </p>
      )}
    </div>
  );
}
