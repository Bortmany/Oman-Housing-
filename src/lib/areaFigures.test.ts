// Area-figure picking tests. Run with: npm test
import { latestAreaFigures } from "./areaFigures";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const row = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  governorateId: "muscat" as string | null,
  cityId: null as string | null,
  neighborhoodId: null,
  propertyType: null as "APARTMENT" | "VILLA" | null,
  periodStart: new Date("2026-03-01"),
  isSample: false,
  avgSalePrice: "100.000" as string | null,
  ...o,
});

expectEqual(
  "newest month wins per place and type",
  latestAreaFigures([
    row("old", { periodStart: new Date("2026-01-01") }),
    row("new", { periodStart: new Date("2026-03-01") }),
  ]).map((r) => r.id),
  ["new"],
);
expectEqual(
  "a count-only row never shadows an older row with figures",
  latestAreaFigures([
    row("figures", { periodStart: new Date("2026-01-01") }),
    row("countOnly", { avgSalePrice: null, periodStart: new Date("2026-03-01") }),
  ]).map((r) => r.id),
  ["figures"],
);
expectEqual(
  "types and places are kept apart",
  latestAreaFigures([
    row("all"),
    row("apt", { propertyType: "APARTMENT" }),
    row("city", { governorateId: null, cityId: "seeb" }),
  ])
    .map((r) => r.id)
    .sort(),
  ["all", "apt", "city"],
);
expectEqual(
  "a sample row steps aside for a real row in the same month",
  latestAreaFigures([row("sample", { isSample: true }), row("real")]).map(
    (r) => r.id,
  ),
  ["real"],
);
expectEqual("nothing in, nothing out", latestAreaFigures([]), []);

if (failures > 0) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log("All area-figure tests passed");
