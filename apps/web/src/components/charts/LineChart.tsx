"use client";

import { CartesianGrid, Line, LineChart as RLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface LineChartSeries {
  key: string;
  color: string;
  label: string;
}

export interface LineChartProps {
  data: Record<string, number | string>[];
  xKey: string;
  series: LineChartSeries[];
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function LineChart({ data, xKey, series, valueFormatter = String, height = 280 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(214 16% 90%)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(215 14% 42%)" }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(215 14% 42%)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={valueFormatter}
          width={56}
        />
        <Tooltip
          formatter={(value: number) => valueFormatter(value)}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(214 16% 88%)" }}
        />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  );
}
