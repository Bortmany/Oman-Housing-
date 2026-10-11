"use client";

import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { recomputeListingAverages, type RecomputeState } from "./recompute-actions";
import { Button } from "@/components/ui/Button";

// The "Recompute now" button and its result box (same boxes as the other admin
// forms: emerald = done, amber = slow down, rose = failed).
export function RecomputeButton({ children }: { children: ReactNode }) {
  const t = useTranslations("listingAverages");
  const tAdmin = useTranslations("adminImport");
  const [state, action, pending] = useActionState<RecomputeState, FormData>(
    () => recomputeListingAverages(),
    null,
  );

  let box: { tone: "ok" | "warn" | "bad"; text: React.ReactNode } | null = null;
  if (state?.kind === "done") {
    box = {
      tone: "ok",
      text:
        state.written + state.kept + state.removed === 0
          ? t("nothing")
          : t("result", {
              written: state.written,
              kept: state.kept,
              removed: state.removed,
            }),
    };
  } else if (state?.kind === "rateLimited") {
    box = { tone: "warn", text: t("rateLimited", { minutes: state.minutes }) };
  } else if (state?.kind === "notAllowed") {
    box = { tone: "bad", text: tAdmin("notAllowed") };
  } else if (state?.kind === "error") {
    box = { tone: "bad", text: t("serverError") };
  }

  const tones = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30",
    warn: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/30",
    bad: "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-400/30",
  } as const;

  return (
    <form action={action}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{children}</div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            aria-busy={pending}
            className="w-full sm:w-auto"
          >
            {pending ? t("running") : t("recompute")}
          </Button>
          <p className="text-xs text-stone-500 sm:max-w-56 sm:text-end dark:text-stone-400">
            {t("recomputeHint")}
          </p>
        </div>
      </div>
      {box && (
        <p
          role={box.tone === "ok" ? "status" : "alert"}
          className={`mt-4 rounded-lg px-4 py-2 text-sm ring-1 ring-inset ${tones[box.tone]}`}
        >
          {box.text}
        </p>
      )}
    </form>
  );
}
