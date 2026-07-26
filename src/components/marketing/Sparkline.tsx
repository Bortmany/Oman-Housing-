"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

// A tiny axis-less trend line for the landing showcase. Colors must come
// from src/lib/chartPalette.ts (the caller passes one). Wrapped dir="ltr"
// on purpose — numeric time series read left-to-right even in Arabic.
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ i, v }));
  const gradientId = `spark-${color.replace("#", "")}`;

  return (
    <div dir="ltr" className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
