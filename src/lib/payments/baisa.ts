// Money in whole baisa (1 OMR = 1000 baisa), by integer maths on the text of
// the amount: no floating point anywhere, so 3.000 is always exactly 3000.
// Tested in payments.test.ts.

/** "3", "3.0", "3.000" -> baisa. Anything else (negative, 4+ decimals, NaN, junk) -> null. */
export function toBaisa(amount: string | number | { toString(): string }): number | null {
  const text = String(amount).trim();
  const m = /^(\d{1,9})(?:\.(\d{1,3}))?$/.exec(text);
  if (!m) return null;
  const rials = Number(m[1]);
  const baisa = Number((m[2] ?? "").padEnd(3, "0") || "0");
  const total = rials * 1000 + baisa;
  return Number.isSafeInteger(total) ? total : null;
}

/** Baisa -> "3.000" (always three decimals) for storing as Decimal(12,3). */
export function baisaToAmount(baisa: number): string {
  if (!Number.isInteger(baisa) || baisa < 0) throw new Error("baisa must be a whole number, 0 or more");
  const rials = Math.floor(baisa / 1000);
  return `${rials}.${String(baisa % 1000).padStart(3, "0")}`;
}
