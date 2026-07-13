"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { AiRating } from "@prisma/client";
import {
  askAnalystAction,
  type AnalystActionState,
} from "@/app/[locale]/(public)/properties/[id]/actions";
import { formatConfidence } from "@/lib/provenance";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea, Label } from "@/components/ui/Field";
import { Link } from "@/i18n/navigation";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";

const ratingStyles: Record<AiRating, string> = {
  BUY: "bg-emerald-100 text-emerald-800",
  CONSIDER: "bg-amber-100 text-amber-800",
  AVOID: "bg-rose-100 text-rose-800",
  INSUFFICIENT_DATA: "bg-stone-100 text-stone-500",
};

const initialState: AnalystActionState = { status: "idle" };

export function AiAnalystCard({
  propertyId,
  signedIn,
  redirectTo,
}: {
  propertyId: string;
  signedIn: boolean;
  redirectTo: string;
}) {
  const t = useTranslations("analyst");
  const [state, formAction, pending] = useActionState(
    askAnalystAction,
    initialState,
  );
  const [question, setQuestion] = useState("");

  const suggestions = [t("suggested1"), t("suggested2"), t("suggested3")];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-stone-900">{t("title")}</h2>
        <ProvenanceBadge provenance="AI_ESTIMATED" />
      </div>
      <p className="mt-1 text-xs text-stone-500">{t("subtitle")}</p>

      {!signedIn ? (
        <div className="mt-4 flex items-center gap-3">
          <p className="text-sm text-stone-600">{t("loginPrompt")}</p>
          <Link
            href={{ pathname: "/login", query: { callbackUrl: redirectTo } }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 hover:bg-stone-100"
          >
            {t("login")}
          </Link>
        </div>
      ) : (
        <>
          <form action={formAction} className="mt-4">
            <input type="hidden" name="propertyId" value={propertyId} />
            <Label htmlFor="analyst-question">{t("questionLabel")}</Label>
            <Textarea
              id="analyst-question"
              name="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder={t("placeholder")}
              disabled={pending}
              required
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => setQuestion(s)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 hover:bg-stone-200 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
              <div className="ms-auto">
                <Button type="submit" disabled={pending}>
                  {pending ? t("asking") : t("ask")}
                </Button>
              </div>
            </div>
          </form>

          {state.status === "error" && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {t(`errors.${state.code}`, { limit: state.limit })}
            </p>
          )}

          {state.status === "done" && (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${ratingStyles[state.rating]}`}
                >
                  {t(`rating.${state.rating}`)}
                </span>
                {state.rating !== "INSUFFICIENT_DATA" && (
                  <span className="text-xs text-stone-500">
                    {t("confidence")}: {formatConfidence(state.confidence)}
                  </span>
                )}
              </div>

              <p className="mt-3 whitespace-pre-line text-sm text-stone-700">
                {state.answer}
              </p>

              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t("dataUsed")}
              </h3>
              {state.citations.length === 0 ? (
                <p className="mt-1 text-xs text-stone-500">{t("noCitations")}</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {state.citations.map((c, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-sm"
                    >
                      <span className="text-stone-600">{c.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900">
                          {c.value}
                        </span>
                        <ProvenanceBadge
                          provenance={c.provenance}
                          confidence={c.confidence}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-xs text-stone-400">{t("disclaimer")}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
