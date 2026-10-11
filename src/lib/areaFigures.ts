// Pure — no I/O. Picks the official whole-area (governorate or city) figures
// the public neighbourhood and market pages show as a separate, labelled card.
// Never merged into a neighbourhood's own figures. Tested in areaFigures.test.ts.
import { latestVisibleStat, type StatKeyFields } from "./db/sampleData";

type FigureFields = {
  avgSalePrice?: unknown;
  avgRentMonthly?: unknown;
  avgPricePerSqm?: unknown;
  grossYieldPct?: unknown;
};

/** True when the row has at least one figure the card can display. */
export function hasAreaDisplayFigure(row: FigureFields): boolean {
  return (
    row.avgSalePrice != null ||
    row.avgRentMonthly != null ||
    row.avgPricePerSqm != null ||
    row.grossYieldPct != null
  );
}

/**
 * The newest row for each place + property type (after the sample-hiding
 * rule), keeping only rows with something to show. Input order is irrelevant.
 */
export function latestAreaFigures<T extends StatKeyFields & FigureFields>(
  rows: T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (!hasAreaDisplayFigure(row)) continue;
    const key = `${row.governorateId ?? ""}|${row.cityId ?? ""}|${row.propertyType ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: T[] = [];
  for (const list of groups.values()) {
    const latest = latestVisibleStat(list);
    if (latest) out.push(latest);
  }
  return out;
}
