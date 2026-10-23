"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart } from "@/components/charts/BarChart";
import { formatCurrencyCompact } from "@/lib/format/currency";
import type { TopConsumedProduct } from "../types";

export function ConsumptionBreakdownChart({ products }: { products: TopConsumedProduct[] }) {
  const data = products.slice(0, 8).map((p) => ({ label: p.name, value: p.valueConsumed }));

  return (
    <Card className="p-4">
      <CardHeader className="border-0 px-0 pb-2 pt-0">
        <CardTitle>Consumption value by product</CardTitle>
      </CardHeader>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No data for this period.</p>
      ) : (
        <BarChart data={data} valueFormatter={(v) => formatCurrencyCompact(v)} />
      )}
    </Card>
  );
}
