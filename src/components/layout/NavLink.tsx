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
          ? "inline-flex min-h-11 items-center rounded-full bg-teal-50 px-3 font-semibold text-teal-800 active:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:active:bg-teal-900"
          : "inline-flex min-h-11 items-center rounded-full px-3 hover:bg-stone-100 hover:text-teal-800 active:bg-stone-200 dark:hover:bg-stone-800 dark:hover:text-teal-300 dark:active:bg-stone-700"
      }
    >
      {children}
    </Link>
  );
}
