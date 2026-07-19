// A small hover hint with no JavaScript at all — pure CSS, so it works in
// server-rendered pages too. The bubble appears after a short pause when the
// mouse rests on the control (or immediately on keyboard focus) and is
// centered over it, so it looks the same in English and Arabic.
//
// The control inside should carry its own accessible text (visible text or an
// aria-label); the bubble itself is hidden from screen readers to avoid
// reading the same thing twice.

export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const position =
    side === "top" ? "bottom-full pb-1.5" : "top-full pt-1.5";

  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute start-0 end-0 z-20 flex justify-center ${position}`}
      >
        <span className="w-max max-w-56 rounded-lg bg-stone-900 px-2.5 py-1.5 text-center text-xs font-normal text-stone-50 shadow-md opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100 group-hover/tooltip:delay-[400ms] group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:delay-0 motion-reduce:transition-none">
          {label}
        </span>
      </span>
    </span>
  );
}
