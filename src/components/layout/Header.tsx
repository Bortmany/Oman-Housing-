import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NavLink } from "./NavLink";
import { SignOutButton } from "./SignOutButton";
import { SignedOutNotice } from "./SignedOutNotice";

// Phone (390 px): two rows that may wrap, nothing overlapping.
//   Row 1: logo at the start; theme, language, Account and (apart, behind a
//          divider) Sign out at the end.
//   Row 2: the main links as pill-shaped targets (44 px tall).
// Laptop: one row. Account and Sign out are separate controls on purpose:
// tapping Account never signs anyone out.
export async function Header() {
  const [t, tc, session] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    auth(),
  ]);
  const role = session?.user.role;
  const isOwner = role === "USER" && !session?.user.agencyId;

  return (
    <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" className="order-1 me-auto flex min-h-11 lg:me-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-teal-800 text-sm font-bold text-white">
            OP
          </span>
          <span className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {tc("appName")}
          </span>
        </Link>

        <nav
          aria-label={t("mainNav")}
          className="order-3 flex w-full flex-wrap items-center gap-1 text-sm font-medium text-stone-600 lg:order-2 lg:w-auto dark:text-stone-300"
        >
          <NavLink href="/properties">{t("properties")}</NavLink>
          <NavLink href="/market">{t("market")}</NavLink>
          <NavLink href="/calculators">{t("calculators")}</NavLink>
          {isOwner && <NavLink href="/account/listings">{t("myProperties")}</NavLink>}
          {role === "AGENCY" && <NavLink href="/agency">{t("agency")}</NavLink>}
          {role === "ADMIN" && <NavLink href="/admin">{t("admin")}</NavLink>}
          {session && <NavLink href="/favorites">{t("favorites")}</NavLink>}
        </nav>

        <div className="order-2 flex flex-wrap items-center gap-2 lg:order-3 lg:ms-auto">
          <ThemeToggle />
          <LocaleSwitcher />
          {session ? (
            <div className="flex items-center gap-2">
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-teal-800 active:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-teal-300 dark:active:bg-stone-700"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
                {t("account")}
              </Link>
              {/* Sign out sits in its own group: a divider and a gap away from Account. */}
              <span aria-hidden="true" className="h-6 w-px bg-stone-300 dark:bg-stone-700" />
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-700 active:bg-teal-900 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
      <Suspense fallback={null}>
        <SignedOutNotice />
      </Suspense>
    </header>
  );
}
