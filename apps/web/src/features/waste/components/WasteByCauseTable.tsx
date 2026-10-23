// apps/web/src/features/waste/components/WasteByCauseTable.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PieChart } from "@/components/charts/PieChart";
import { WasteCauseBadge } from "./WasteCauseBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { WASTE_CAUSE_COLORS } from "../constants";
import type { WasteCause, WasteSummary } from "../types";

const DEFAULT_COLOR = "hsl(215 10% 60%)";

function colorForCause(cause: WasteCause): string {
  return WASTE_CAUSE_COLORS[cause] ?? DEFAULT_COLOR;
}

export function WasteByCauseTable({
  byCause,
}: {
  byCause: WasteSummary["byCause"];
}) {
  const rows = Array.isArray(byCause) ? byCause : [];

  const chartData = rows.map((c) => ({
    label: c.cause,
    value: c.value,
    color: colorForCause(c.cause),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waste by cause</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No waste recorded for this period.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
            <PieChart
              data={chartData}
              valueFormatter={(v) => formatCurrency(v)}
            />
            <ul className="flex flex-col gap-2">
              {rows.map((c) => (
                <li
                  key={c.cause}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm"
                >
                  <WasteCauseBadge cause={c.cause} />
                  <span className="tabular-nums text-ink">
                    {formatCurrency(c.value)}
                  </span>
                  <span className="tabular-nums text-ink-faint">
                    {formatQuantity(c.quantity, "units")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}