import type { Prisma } from "@prisma/client";

// OMR has 3 decimal places (baisa). Every displayed amount goes through here.

function omrLocale(locale: string) {
  // Latin digits in the Arabic UI — the norm for Gulf real estate figures.
  return locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM";
}

/** Full-precision OMR: "OMR 1,250.500". The default for exact figures. */
export function formatOMR(value: number | string, locale: string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(omrLocale(locale), {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

/** Rounded OMR for dashboard cards ("OMR 350,000") — never 2 decimals. */
export function formatOMRWhole(value: number | string, locale: string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(omrLocale(locale), {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(value: number | string, locale: string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(omrLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 100);
}

/** Prisma Decimal → string at the server/client boundary (never pass Decimal to the client). */
export function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value == null ? null : value.toString();
}

export function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  return value == null ? null : Number(value.toString());
}
