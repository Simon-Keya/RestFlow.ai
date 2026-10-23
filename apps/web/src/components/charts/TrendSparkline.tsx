"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

/** Tiny inline trend line for KPI cards / table rows — no axes, no tooltip, just shape. */
export function TrendSparkline({ data, color = "hsl(168 62% 34%)", height = 32 }: { data: number[]; color?: string; height?: number }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <ResponsiveContainer width={80} height={height}>
      <LineChart data={points}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
