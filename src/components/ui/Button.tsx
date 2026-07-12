import { type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { Link } from "@/i18n/navigation";

const variants = {
  primary:
    "bg-teal-800 text-white hover:bg-teal-700 focus-visible:outline-teal-800",
  secondary:
    "bg-white text-stone-900 ring-1 ring-stone-300 hover:bg-stone-100 focus-visible:outline-stone-400",
  danger: "bg-rose-700 text-white hover:bg-rose-600 focus-visible:outline-rose-700",
  ghost: "text-teal-800 hover:bg-teal-50 focus-visible:outline-teal-800",
} as const;

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  variant?: Variant;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
