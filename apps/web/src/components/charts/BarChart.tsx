"use client";

import { Bar, BarChart as RBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  color?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function BarChart({ data, color = "hsl(168 62% 34%)", valueFormatter = String, height = 260 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(214 16% 90%)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215 14% 42%)" }} tickLine={false} axisLine={false} />
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
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </RBarChart>
    </ResponsiveContainer>
  );
}
