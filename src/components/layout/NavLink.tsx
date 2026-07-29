"use client";

import { usePathname, Link } from "@/i18n/navigation";

// A header nav link that visibly knows when you're already on its page:
// the active item gets a teal chip + bold text (and aria-current for
// screen readers); the rest stay plain.
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full bg-teal-50 px-3 py-1.5 font-semibold text-teal-800"
          : "px-3 py-1.5 hover:text-teal-800"
      }
    >
      {children}
    </Link>
  );
}
