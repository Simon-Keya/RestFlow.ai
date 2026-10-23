import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatQuantity } from "@/lib/format/numbers";
import { formatCurrency } from "@/lib/format/currency";
import { REASON_CODE_LABELS } from "../constants";
import type { VarianceLine } from "../types";

export function IngredientVarianceTable({ lines, onSelectLine }: { lines: VarianceLine[]; onSelectLine?: (itemId: string) => void }) {
  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Item</TableHeaderCell>
          <TableHeaderCell className="text-right">Expected</TableHeaderCell>
          <TableHeaderCell className="text-right">Counted</TableHeaderCell>
          <TableHeaderCell className="text-right">Variance</TableHeaderCell>
          <TableHeaderCell className="text-right">Value</TableHeaderCell>
          <TableHeaderCell>Reason code</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.itemId} onClick={() => onSelectLine?.(line.itemId)} className="cursor-pointer">
            <TableCell className="font-medium">{line.itemName}</TableCell>
            <TableCell className="text-right tabular-nums">{formatQuantity(line.expectedQuantity, line.unit)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatQuantity(line.countedQuantity, line.unit)}</TableCell>
            <TableCell className="text-right tabular-nums">
              <span className={line.varianceQuantity < 0 ? "text-danger-600" : line.varianceQuantity > 0 ? "text-success-600" : "text-ink-muted"}>
                {line.varianceQuantity > 0 ? "+" : ""}
                {formatQuantity(line.varianceQuantity, line.unit)}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(line.varianceValue)}</TableCell>
            <TableCell>{line.reasonCode ? <Badge tone="neutral">{REASON_CODE_LABELS[line.reasonCode] ?? line.reasonCode}</Badge> : <span className="text-ink-faint">—</span>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
