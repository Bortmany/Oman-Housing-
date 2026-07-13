"use server";

import { getLocale, getTranslations } from "next-intl/server";
import type { AiRating, DataProvenance } from "@prisma/client";
import { auth } from "@/auth";
import {
  runAnalyst,
  DAILY_QUESTION_LIMIT,
  type AnalystErrorCode,
} from "@/lib/ai/analyst";
import { formatOMRWhole, formatPercent } from "@/lib/money";
import type { OfferedDatum } from "@/lib/ai/analystCore";

export type AnalystCitationView = {
  label: string;
  value: string;
  provenance: DataProvenance;
  confidence: number;
};

export type AnalystActionState =
  | { status: "idle" }
  | { status: "error"; code: AnalystErrorCode | "loginRequired"; limit: number }
  | {
      status: "done";
      rating: AiRating;
      confidence: number;
      answer: string;
      citations: AnalystCitationView[];
    };

function formatDatumValue(
  format: OfferedDatum["format"],
  value: number | string,
  locale: string,
): string {
  switch (format) {
    case "money":
      return formatOMRWhole(value, locale);
    case "percent":
      return formatPercent(value, locale);
    case "score":
      return `${value}/100`;
    default:
      return String(value);
  }
}

export async function askAnalystAction(
  _prev: AnalystActionState,
  formData: FormData,
): Promise<AnalystActionState> {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session) {
    return { status: "error", code: "loginRequired", limit: DAILY_QUESTION_LIMIT };
  }

  const t = await getTranslations("analyst");
  const propertyId = String(formData.get("propertyId") ?? "");
  const question = String(formData.get("question") ?? "");

  const result = await runAnalyst({
    userId: session.user.id,
    propertyId,
    question,
    locale,
    insufficientAnswer: t("insufficientAnswer"),
  });

  if (!result.ok) {
    return { status: "error", code: result.code, limit: DAILY_QUESTION_LIMIT };
  }

  return {
    status: "done",
    rating: result.verdict.rating,
    confidence: result.verdict.confidence,
    answer: result.verdict.answer,
    citations: result.verdict.citations.map((c) => ({
      label: t(`data.${c.labelKey}`, c.labelParams ?? {}),
      value: formatDatumValue(c.format, c.value, locale),
      provenance: c.provenance,
      confidence: c.confidence,
    })),
  };
}
