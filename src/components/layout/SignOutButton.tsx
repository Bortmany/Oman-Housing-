"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Tooltip } from "@/components/ui/Tooltip";

// A plain button (not a form submit) that signs this device out. It lives in
// its own group in the header, away from Account, so a tap on Account can never
// sign anyone out. After sign-out the home page shows a small "Signed out." note.
export function SignOutButton() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  return (
    <Tooltip label={t("signOutHint")} side="bottom">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          setPending(true);
          void signOut({ redirectTo: `/${locale}?signedOut=1` });
        }}
        className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100 hover:text-rose-700 active:bg-stone-200 disabled:opacity-60 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800 dark:hover:text-rose-300 dark:active:bg-stone-700"
      >
        {pending ? t("signingOut") : t("signOut")}
      </button>
    </Tooltip>
  );
}
