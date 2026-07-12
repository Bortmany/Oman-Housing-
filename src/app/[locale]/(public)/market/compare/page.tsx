import { getLocale, getTranslations } from "next-intl/server";
import type { PropertyType } from "@prisma/client";
import {
  allNeighborhoods,
  neighborhoodTrends,
} from "@/lib/db/market-stats";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatOMRWhole, formatPercent } from "@/lib/money";
import { localName, formatMonth } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { Select, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("compare") };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; type?: string }>;
}) {
  const { a, b, type } = await searchParams;
  const propertyType: PropertyType = type === "villa" ? "VILLA" : "APARTMENT";

  const [t, tc, te, locale, hoods] = await Promise.all([
    getTranslations("market"),
    getTranslations("common"),
    getTranslations("enums"),
    getLocale(),
    allNeighborhoods(),
  ]);

  const hoodA = hoods.find((h) => h.slug === a) ?? null;
  const hoodB = hoods.find((h) => h.slug === b) ?? null;
  const chosen = [hoodA, hoodB].filter(
    (h): h is NonNullable<typeof h> => h != null,
  );

  let trendData: TrendPoint[] = [];
  let latest: Array<{
    hood: (typeof chosen)[number];
    stat: Awaited<ReturnType<typeof prisma.marketStat.findFirst>>;
  }> = [];

  if (chosen.length === 2) {
    const rows = await neighborhoodTrends(
      chosen.map((h) => h.id),
      propertyType,
    );
    const map = new Map<number, TrendPoint>();
    for (const r of rows) {
      const key = r.periodStart.getTime();
      if (!map.has(key)) map.set(key, { label: formatMonth(locale, r.periodStart) });
      map.get(key)![r.neighborhoodId!] = decimalToNumber(r.avgSalePrice);
    }
    trendData = [...map.entries()].sort(([x], [y]) => x - y).map(([, v]) => v);

    latest = await Promise.all(
      chosen.map(async (hood) => ({
        hood,
        stat: await prisma.marketStat.findFirst({
          where: { neighborhoodId: hood.id, propertyType },
          orderBy: { periodStart: "desc" },
        }),
      })),
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900">{t("compare")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("compareHint")}</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <Label htmlFor="a">{t("selectA")}</Label>
          <Select id="a" name="a" defaultValue={a ?? ""}>
            <option value="" disabled>
              {tc("none")}
            </option>
            {hoods.map((h) => (
              <option key={h.id} value={h.slug}>
                {localName(locale, h.nameEn, h.nameAr)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-48">
          <Label htmlFor="b">{t("selectB")}</Label>
          <Select id="b" name="b" defaultValue={b ?? ""}>
            <option value="" disabled>
              {tc("none")}
            </option>
            {hoods.map((h) => (
              <option key={h.id} value={h.slug}>
                {localName(locale, h.nameEn, h.nameAr)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-36">
          <Label htmlFor="type">{t("propertyType")}</Label>
          <Select id="type" name="type" defaultValue={type ?? "apartment"}>
            <option value="apartment">{t("apartments")}</option>
            <option value="villa">{t("villas")}</option>
          </Select>
        </div>
        <Button type="submit">{t("compare")}</Button>
      </form>

      {chosen.length === 2 && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {latest.map(({ hood, stat }) => (
              <Card key={hood.id}>
                <h2 className="font-semibold text-stone-900">
                  {localName(locale, hood.nameEn, hood.nameAr)}
                </h2>
                {stat ? (
                  <>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-stone-500">{t("avgSalePrice")}</dt>
                        <dd className="font-semibold">
                          {stat.avgSalePrice
                            ? formatOMRWhole(stat.avgSalePrice.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500">{t("avgRentMonthly")}</dt>
                        <dd className="font-semibold">
                          {stat.avgRentMonthly
                            ? formatOMRWhole(stat.avgRentMonthly.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500">{t("avgPricePerSqm")}</dt>
                        <dd className="font-semibold">
                          {stat.avgPricePerSqm
                            ? formatOMRWhole(stat.avgPricePerSqm.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-stone-500">{t("grossYield")}</dt>
                        <dd className="font-semibold">
                          {stat.grossYieldPct
                            ? formatPercent(stat.grossYieldPct.toString(), locale)
                            : tc("none")}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <ProvenanceBadge
                        provenance={stat.provenance}
                        confidence={stat.confidence}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-stone-500">{t("noData")}</p>
                )}
              </Card>
            ))}
          </div>

          {trendData.length > 0 && (
            <Card className="mt-6">
              <h2 className="text-base font-semibold text-stone-900">
                {t("priceTrends")} — {te(`propertyType.${propertyType}`)}
              </h2>
              <div className="mt-4">
                <TrendChart
                  data={trendData}
                  series={chosen.map((h) => ({
                    key: h.id,
                    name: localName(locale, h.nameEn, h.nameAr),
                  }))}
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
