"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

/** A submit button that shows it is working and cannot be pressed twice. */
export function PendingButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending} aria-busy={pending}>
      {pending && (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      )}
      {children}
    </Button>
  );
}
