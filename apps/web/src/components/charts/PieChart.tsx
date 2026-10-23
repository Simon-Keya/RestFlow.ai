"use client";

import { Cell, Legend, Pie, PieChart as RPieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface PieChartDatum {
  label: string;
  value: number;
  color: string;
}

export function PieChart({ data, valueFormatter = String, height = 240 }: { data: PieChartDatum[]; valueFormatter?: (v: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RPieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} stroke="hsl(0 0% 100%)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => valueFormatter(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RPieChart>
    </ResponsiveContainer>
  );
}
