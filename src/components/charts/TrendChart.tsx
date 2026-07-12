"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useLocale } from "next-intl";
import { CHART_COLORS, CHART_GRID, CHART_AXIS } from "@/lib/chartPalette";

export type TrendSeries = { key: string; name: string };
export type TrendPoint = { label: string } & Record<string, string | number | null>;

function makeFormatter(locale: string, kind: "omr" | "percent") {
  const tag = locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM";
  if (kind === "percent") {
    const nf = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    return (v: number) => `${nf.format(v)}%`;
  }
  const nf = new Intl.NumberFormat(tag, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (v: number) => nf.format(v);
}

// One reusable time-series line chart: single y-axis, recessive grid, 2px
// lines, hover crosshair + tooltip, legend only when there are >= 2 series.
// Rendered LTR even in the Arabic UI — numeric time axes read left-to-right.
export function TrendChart({
  data,
  series,
  valueKind = "omr",
  height = 280,
}: {
  data: TrendPoint[];
  series: TrendSeries[];
  valueKind?: "omr" | "percent";
  height?: number;
}) {
  const locale = useLocale();
  const fmt = makeFormatter(locale, valueKind);

  return (
    <div dir="ltr" className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmt}
            width={52}
          />
          <Tooltip
            formatter={(value) => fmt(Number(value))}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${CHART_GRID}`,
              fontSize: 12,
            }}
          />
          {series.length >= 2 && (
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
