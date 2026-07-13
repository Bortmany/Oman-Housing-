"use server";

import { z } from "zod";
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
import { prisma } from "@/lib/prisma";
import {
  createInquiry,
  countRecentInquiriesByEmail,
} from "@/lib/db/inquiries";
import {
  evaluateEnquiry,
  ENQUIRY_WINDOW_MS,
  MAX_MESSAGE_LENGTH,
} from "@/lib/enquiry";

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

// ---------- Buyer enquiry ----------

export type EnquiryActionState =
  | { status: "idle" }
  | { status: "error"; code: "invalid" | "rateLimited" | "unavailable" }
  | { status: "sent"; savedToAccount: boolean };

const enquirySchema = z.object({
  listingId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export async function sendEnquiryAction(
  _prev: EnquiryActionState,
  formData: FormData,
): Promise<EnquiryActionState> {
  const session = await auth();

  const parsed = enquirySchema.safeParse({
    listingId: formData.get("listingId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) return { status: "error", code: "invalid" };
  const d = parsed.data;

  // Spam guards: hidden honeypot must be empty, and cap enquiries per email/day.
  const honeypot = String(formData.get("company") ?? ""); // named to look real to bots
  const recentCount = await countRecentInquiriesByEmail(d.email, ENQUIRY_WINDOW_MS);
  const verdict = evaluateEnquiry({ honeypot, recentCount });
  if (verdict === "honeypot") return { status: "sent", savedToAccount: false }; // silently drop bots
  if (verdict === "rateLimited") return { status: "error", code: "rateLimited" };

  // The listing must exist and be publicly active to receive enquiries.
  const listing = await prisma.listing.findFirst({
    where: { id: d.listingId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!listing) return { status: "error", code: "unavailable" };

  await createInquiry({
    listingId: listing.id,
    fromUserId: session?.user.id ?? null,
    name: d.name,
    email: d.email,
    phone: d.phone ?? null,
    message: d.message,
  });

  // TODO(Phase 5 email): notify the listing's agency (and admin) that a new
  // enquiry arrived. Wired in Part B once an email provider key exists.

  return { status: "sent", savedToAccount: !!session };
}
