"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { TakeDownReason } from "@/lib/listings/rules";
import type { ActionError, ListingPanelActions } from "./types";

// The listing page's action panel: Edit, Take it off the site (sold / rented /
// withdraw), Send for review again, Delete draft. Shown only for what applies.
// "Withdraw" is never "delete" — nothing is removed and enquiries survive.
// The actions arrive as props so owners and agencies share this panel.

type Props = {
  listingId: string;
  status: string;
  listingType: "SALE" | "RENT";
  actions: ListingPanelActions;
  /** Where to go after a draft is deleted. */
  listHref: string;
  /** Owner at the 3-listing limit: the resend button is replaced by this message. */
  capMessage?: string | null;
};

export function ListingActionsPanel({ listingId, status, listingType, actions, listHref, capMessage }: Props) {
  const t = useTranslations("myListing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<null | "takeDown" | "delete">(null);
  const [reason, setReason] = useState<TakeDownReason>("WITHDRAW");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isLive = status === "ACTIVE";
  const isReview = status === "PENDING_REVIEW";
  const isDraft = status === "DRAFT";
  const canResend = ["REJECTED", "ARCHIVED", "SOLD", "RENTED"].includes(status);

  const errorText = (e: ActionError) =>
    e === "rateLimited" ? t("errors.rateLimited")
    : e === "capReached" ? t("errors.capReached")
    : e === "wrongState" ? t("errors.wrongState")
    : e === "notFound" ? t("errors.notFound")
    : e === "phoneNotVerified" ? t("errors.phoneNotVerified")
    : t("errors.saveFailed");

  const scrollToForm = () => document.getElementById("listing-form")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const takeDown = () => {
    setError(null);
    startTransition(async () => {
      const res = await actions.takeDown(listingId, reason);
      if (!res.ok) { setError(errorText(res.error)); return; }
      setOpen(null);
      setDone(reason === "SOLD" ? t("doneSold") : reason === "RENTED" ? t("doneRented") : t("doneWithdrawn"));
      router.refresh();
    });
  };
  const resubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await actions.resubmit(listingId);
      if (!res.ok) { setError(errorText(res.error)); return; }
      setDone(t("doneResubmit"));
      router.refresh();
    });
  };
  const remove = () => {
    setError(null);
    startTransition(async () => {
      const res = await actions.deleteDraft(listingId);
      if (!res.ok) { setError(errorText(res.error)); return; }
      router.push(listHref);
    });
  };

  const choices: Array<{ value: TakeDownReason; label: string; body: string }> = [];
  if (isLive && listingType === "SALE") choices.push({ value: "SOLD", label: t("reasonSold"), body: t("soldBody") });
  if (isLive && listingType === "RENT") choices.push({ value: "RENTED", label: t("reasonRented"), body: t("rentedBody") });
  choices.push({ value: "WITHDRAW", label: t("reasonWithdrawn"), body: t("withdrawBody") });

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t("actionsTitle")}</h2>
      {done && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100">{done}</p>}

      {!canResend && (
        <Button type="button" variant={isDraft ? "primary" : "secondary"} className="w-full" onClick={scrollToForm}>
          {isDraft ? t("continue") : t("edit")}
        </Button>
      )}
      {canResend && (
        <>
          {capMessage ? (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">{capMessage}</p>
          ) : (
            <>
              <Button type="button" className="w-full" disabled={pending} onClick={resubmit}>
                {pending ? t("working") : t("resubmit")}
              </Button>
              <p className="text-xs text-stone-500 dark:text-stone-400">{t("resubmitBody")}</p>
            </>
          )}
          <Button type="button" variant="secondary" className="w-full" onClick={scrollToForm}>{t("edit")}</Button>
        </>
      )}

      {(isLive || isReview) && (
        <div className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800">
          {open !== "takeDown" ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full !text-rose-700 dark:!text-rose-400"
              onClick={() => { setOpen("takeDown"); setReason(isLive && listingType === "SALE" ? "SOLD" : isLive ? "RENTED" : "WITHDRAW"); setError(null); }}
            >
              {isReview ? t("withdraw") : t("takeDown")}
            </Button>
          ) : (
            <div role="group" aria-label={t("takeDownTitle")} className="space-y-3">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{t("takeDownTitle")}</p>
              {(isReview ? choices.filter((c) => c.value === "WITHDRAW") : choices).map((c) => (
                <label key={c.value} className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-lg px-3 text-sm ring-1 ${reason === c.value ? "bg-stone-50 ring-teal-700 dark:bg-stone-800" : "ring-stone-300 dark:ring-stone-700"}`}>
                  <input type="radio" name={`reason-${listingId}`} checked={reason === c.value} onChange={() => setReason(c.value)} className="size-4" />
                  <span>{c.label}</span>
                </label>
              ))}
              <p className="text-sm text-stone-600 dark:text-stone-300">{choices.find((c) => c.value === reason)?.body}</p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" className="flex-1" disabled={pending} onClick={takeDown}>
                  {pending ? t("working") : t("confirm")}
                </Button>
                <Button type="button" variant="secondary" className="flex-1" autoFocus disabled={pending} onClick={() => setOpen(null)}>
                  {isReview ? t("keepInReview") : t("keepLive")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isDraft && (
        <div className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800">
          {open !== "delete" ? (
            <Button type="button" variant="secondary" className="w-full !text-rose-700 dark:!text-rose-400" onClick={() => { setOpen("delete"); setError(null); }}>
              {t("deleteDraft")}
            </Button>
          ) : (
            <div role="group" className="space-y-3">
              <p className="text-sm text-stone-700 dark:text-stone-300">{t("deleteDraftConfirm")}</p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" className="flex-1" disabled={pending} onClick={remove}>
                  {pending ? t("working") : t("deleteYes")}
                </Button>
                <Button type="button" variant="secondary" className="flex-1" autoFocus disabled={pending} onClick={() => setOpen(null)}>
                  {t("keepIt")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">{error}</p>}
    </Card>
  );
}
