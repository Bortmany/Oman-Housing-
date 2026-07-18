"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import {
  MARKET_DATA_CACHE_TAG,
  upsertMarketStat,
  type StatScope,
} from "@/lib/db/market-stats";
import { PROVENANCE_VALUES } from "@/lib/provenance";
import { requireAdmin } from "@/lib/require-admin";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE",
  "LAND", "OFFICE", "RETAIL", "WAREHOUSE",
] as const;

// "" → null, otherwise a finite number
const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite().min(0).nullable(),
);

const statSchema = z.object({
  scope: z.string().regex(/^(national|[gcn]:[a-z0-9]+)$/),
  propertyType: z.enum(PROPERTY_TYPES).nullable(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  avgSalePrice: optionalNumber,
  medianSalePrice: optionalNumber,
  avgRentMonthly: optionalNumber,
  avgPricePerSqm: optionalNumber,
  grossYieldPct: optionalNumber,
  transactionCount: optionalNumber,
  sampleSize: optionalNumber,
  provenance: z.enum(PROVENANCE_VALUES),
  confidence: z.preprocess((v) => Number(v), z.number().min(0).max(1)),
  sourceNote: z.string().trim().max(500).optional(),
  sourceUrl: z.union([z.literal(""), z.string().trim().url().max(500)]).optional(),
});

export type StatFormState = {
  error?: "validationFailed" | "atLeastOneMetric";
} | null;

function parseScope(raw: string): StatScope {
  if (raw === "national") return { kind: "national" };
  const [prefix, id] = raw.split(":");
  if (prefix === "g") return { kind: "governorate", id };
  if (prefix === "c") return { kind: "city", id };
  return { kind: "neighborhood", id };
}

export async function saveMarketStat(
  _prev: StatFormState,
  formData: FormData,
): Promise<StatFormState> {
  const session = await requireAdmin();
  if (!session) return { error: "validationFailed" };

  const parsed = statSchema.safeParse({
    scope: formData.get("scope"),
    propertyType: formData.get("propertyType") || null,
    period: formData.get("period"),
    avgSalePrice: formData.get("avgSalePrice"),
    medianSalePrice: formData.get("medianSalePrice"),
    avgRentMonthly: formData.get("avgRentMonthly"),
    avgPricePerSqm: formData.get("avgPricePerSqm"),
    grossYieldPct: formData.get("grossYieldPct"),
    transactionCount: formData.get("transactionCount"),
    sampleSize: formData.get("sampleSize"),
    provenance: formData.get("provenance"),
    confidence: formData.get("confidence"),
    sourceNote: formData.get("sourceNote") ?? "",
    sourceUrl: formData.get("sourceUrl") ?? "",
  });
  if (!parsed.success) return { error: "validationFailed" };

  const d = parsed.data;
  const metrics = {
    avgSalePrice: d.avgSalePrice,
    medianSalePrice: d.medianSalePrice,
    avgRentMonthly: d.avgRentMonthly,
    avgPricePerSqm: d.avgPricePerSqm,
    grossYieldPct: d.grossYieldPct,
    transactionCount: d.transactionCount == null ? null : Math.round(d.transactionCount),
    sampleSize: d.sampleSize == null ? null : Math.round(d.sampleSize),
  };
  if (Object.values(metrics).every((v) => v == null)) {
    return { error: "atLeastOneMetric" };
  }

  const [year, month] = d.period.split("-").map(Number);
  const { updated } = await upsertMarketStat({
    scope: parseScope(d.scope),
    propertyType: d.propertyType,
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    metrics,
    provenance: d.provenance,
    confidence: d.confidence,
    sourceNote: d.sourceNote || null,
    sourceUrl: d.sourceUrl || null,
    verifiedById: session.user.id,
  });

  updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({
    href: `/admin/market-stats?saved=1${updated ? "&updated=1" : ""}`,
    locale,
  });
  return null;
}

export async function deleteMarketStat(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (id) await prisma.marketStat.delete({ where: { id } });

  updateTag(MARKET_DATA_CACHE_TAG); // cached public market pages refresh now
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/admin/market-stats?deleted=1", locale });
}
