"use client";

import { TableRow, TableCell } from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatQuantity } from "@/lib/format/numbers";
import type { ClosingStockEntry } from "../types";

export function ClosingStockRow({
  entry,
  value,
  onChange,
  readOnly = false,
}: {
  entry: ClosingStockEntry;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const expected =
    entry.expectedQuantity ??
    (entry as { systemQty?: number }).systemQty ??
    0;
  const counted = value === "" ? null : Number(value);
  const variance = counted !== null ? counted - expected : null;

  return (
    <TableRow>
      <TableCell className="font-medium">{entry.name}</TableCell>
      <TableCell className="text-right tabular-nums text-ink-muted">
        {formatQuantity(expected, entry.unit)}
      </TableCell>
      <TableCell className="text-right">
        {readOnly ? (
          <span className="tabular-nums text-ink-muted">—</span>
        ) : (
          <Input
            type="number"
            step="0.01"
            className="w-28 text-right"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Count"
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {variance === null ? (
          <span className="text-ink-faint">—</span>
        ) : variance === 0 ? (
          <Badge tone="success">Matches</Badge>
        ) : (
          <Badge
            tone={
              Math.abs(variance) / Math.max(expected, 1) > 0.1
                ? "danger"
                : "warning"
            }
          >
            {variance > 0 ? "+" : ""}
            {variance.toFixed(2)} {entry.unit}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
