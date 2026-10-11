"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveFreeLaunch, type FreeLaunchState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";

export function FreeLaunchCard({
  initialOn,
  initialChangedAt,
}: {
  initialOn: boolean;
  initialChangedAt: string | null;
}) {
  const t = useTranslations("adminSettings");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FreeLaunchState, FormData>(
    saveFreeLaunch,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  // What the screen shows: the last saved result, else what the page loaded with.
  const on = state?.status === "saved" ? state.on : initialOn;
  const changedAt = state?.status === "saved" ? state.changedAt : initialChangedAt;

  const date = changedAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(changedAt))
    : null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">{t("freeLaunch.label")}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            on
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30"
              : "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700"
          }`}
        >
          {on ? t("freeLaunch.on") : t("freeLaunch.off")}
        </span>
      </div>

      <form action={action} onSubmit={() => setConfirming(false)}>
        {/* Turning OFF asks first (inline, not a pop-up); turning ON does not. */}
        {on && confirming ? (
          <div
            role="alertdialog"
            aria-label={t("freeLaunch.confirmOff")}
            className="space-y-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/30"
          >
            <p>{t("freeLaunch.confirmOff")}</p>
            <input type="hidden" name="value" value="off" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
                {pending && <Spinner />}
                {t("freeLaunch.confirmYes")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                autoFocus
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                {t("freeLaunch.keepOn")}
              </Button>
            </div>
          </div>
        ) : on ? (
          <Tooltip label={t("freeLaunch.tip")} className="w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              {t("freeLaunch.turnOff")}
            </Button>
          </Tooltip>
        ) : (
          <Tooltip label={t("freeLaunch.tip")} className="w-full sm:w-auto">
            <input type="hidden" name="value" value="on" />
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={pending}
              aria-busy={pending}
            >
              {pending && <Spinner />}
              {t("freeLaunch.turnOn")}
            </Button>
          </Tooltip>
        )}
      </form>

      <div aria-live="polite" className="min-h-5 text-sm">
        {state?.status === "saved" && (
          <p className="text-emerald-700 dark:text-emerald-300">{t("saved")}</p>
        )}
        {state?.status === "tooMany" && (
          <p className="text-rose-700 dark:text-rose-300">{t("tooMany")}</p>
        )}
        {state?.status === "error" && (
          <p className="text-rose-700 dark:text-rose-300">{t("error")}</p>
        )}
      </div>

      <p className="text-sm text-stone-600 dark:text-stone-300">
        {on ? t("freeLaunch.helpOn") : t("freeLaunch.helpOff")}
      </p>
      <hr className="border-stone-200 dark:border-stone-800" />
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {date ? t("freeLaunch.lastChanged", { date }) : t("freeLaunch.neverChanged")}
      </p>
    </Card>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}
