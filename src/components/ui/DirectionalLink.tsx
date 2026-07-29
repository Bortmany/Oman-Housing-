import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

// A text link whose chevron always points the honest way: "back" points
// toward the start of the reading direction (left in English, right in
// Arabic) and "forward" points toward the end. The rtl:rotate-180 flip is
// what a hardcoded "‹" or "←" character can never do.
function Chevron({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0 rtl:rotate-180"
    >
      {direction === "back" ? (
        <path d="M12.5 15.5 7 10l5.5-5.5" />
      ) : (
        <path d="M7.5 4.5 13 10l-5.5 5.5" />
      )}
    </svg>
  );
}

export function DirectionalLink({
  direction,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { direction: "back" | "forward" }) {
  return (
    <Link className={`inline-flex items-center gap-1 ${className}`} {...props}>
      {direction === "back" && <Chevron direction="back" />}
      {children}
      {direction === "forward" && <Chevron direction="forward" />}
    </Link>
  );
}
