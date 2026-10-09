"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { startFeaturedPayment } from "../actions";

// The pay button. The browser sends only the listing id. On success we
// navigate to the gateway's page BY SCRIPT (the site's security policy only
// allows form posts to itself, so this must not be an HTML form) and keep the
// button disabled until the page unloads, so a double click cannot start a
// second session.

type Props = {
  listingId: string;
  label: string;
  workingLabel: string;
  note: string;
  errors: { rateLimited: string; startFailed: string; wrongState: string };
};

export function PayButton({ listingId, label, workingLabel, note, errors }: Props) {
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = () => {
    if (pending || leaving) return;
    setError(null);
    startTransition(async () => {
      const res = await startFeaturedPayment(listingId);
      if (!res.ok) {
        setError(errors[res.error]);
        return;
      }
      // Only ever go to a secure address.
      let target: URL;
      try {
        target = new URL(res.url);
      } catch {
        setError(errors.startFailed);
        return;
      }
      if (target.protocol !== "https:") {
        setError(errors.startFailed);
        return;
      }
      setLeaving(true);
      window.location.assign(target.toString());
    });
  };

  const busy = pending || leaving;
  return (
    <div className="space-y-2">
      <Button type="button" className="w-full" disabled={busy} aria-busy={busy} onClick={pay}>
        {busy && (
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        )}
        {busy ? workingLabel : label}
      </Button>
      <p className="text-xs text-stone-500 dark:text-stone-400">{note}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          {error}
        </p>
      )}
    </div>
  );
}
