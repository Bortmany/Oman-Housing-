"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Copies the plain-text report to the clipboard and says so. */
export function CopyButton({ text, label, doneLabel }: { text: string; label: string; doneLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {label}
      </Button>
      <span role="status" className="text-sm text-emerald-800 dark:text-emerald-300">
        {copied ? doneLabel : ""}
      </span>
    </>
  );
}
