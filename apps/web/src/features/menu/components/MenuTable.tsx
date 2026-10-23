// apps/web/src/features/menu/components/MenuTable.tsx
"use client";

import { UtensilsCrossed } from "lucide-react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format/currency";
import { formatPercent } from "@/lib/format/percent";
import type { MenuItem } from "../types";

export function MenuTable({ items }: { items: MenuItem[] }) {
  const list = items ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="No menu items yet"
        description="Create a menu item with fixed finished goods and optional choice pools."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Components</TableHeaderCell>
          <TableHeaderCell className="text-right">Price</TableHeaderCell>
          <TableHeaderCell className="text-right">Food cost</TableHeaderCell>
          <TableHeaderCell className="text-right">Margin</TableHeaderCell>
          <TableHeaderCell className="text-right">Can sell</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {list.map((m) => {
          const lines = m.lines ?? [];
          const foodCost = m.foodCost ?? m.unitCost ?? 0;
          const margin = m.margin ?? (m.sellingPrice || 0) - foodCost;
          const marginPct =
            m.marginPercent ??
            (m.sellingPrice > 0 ? margin / m.sellingPrice : null);
          const marginTone =
            marginPct == null
              ? "neutral"
              : marginPct < 0.2
                ? "danger"
                : marginPct < 0.35
                  ? "warning"
                  : "success";

          return (
            <TableRow key={m.menuId}>
              <TableCell>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-ink-faint">
                  {m.menuCode || m.menuId}
                  {m.category ? ` · ${m.category}` : ""}
                  {m.requiresSelection ? " · choices" : ""}
                </div>
              </TableCell>
              <TableCell className="text-ink-muted">
                {lines.length === 0 ? (
                  "—"
                ) : (
                  <ul className="space-y-0.5 text-sm">
                    {lines.map((l) => (
                      <li key={l.componentKey}>
                        {l.componentType === "FIXED" ? (
                          <>
                            <span className="font-medium text-ink">
                              {l.quantityRequired}×{" "}
                              {l.finishedGoodName || l.finishedGoodId}
                            </span>
                            <span className="text-xs text-ink-faint">
                              {" "}
                              (fixed · {l.availableStock} {l.unit})
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-ink">
                              {l.finishedGoodCategoryName ||
                                l.finishedGoodCategoryCode ||
                                (l.options?.length
                                  ? `${l.options.length} inventory SKUs`
                                  : null) ||
                                l.componentKey}
                            </span>
                            <span className="text-xs text-ink-faint">
                              {" "}
                              ({l.componentType.toLowerCase()} ·{" "}
                              {l.options?.length ?? 0} options)
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(m.sellingPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-ink-muted">
                {formatCurrency(foodCost)}
              </TableCell>
              <TableCell className="text-right">
                <div className="tabular-nums">{formatCurrency(margin)}</div>
                <div className="text-xs text-ink-faint">
                  {marginPct == null ? "—" : formatPercent(marginPct)}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {m.maxPortions}
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={m.maxPortions > 0 ? "success" : "danger"}>
                    {m.maxPortions > 0 ? "Available" : "86'd"}
                  </Badge>
                  {marginPct != null ? (
                    <Badge
                      tone={
                        marginTone as
                          | "danger"
                          | "warning"
                          | "success"
                          | "neutral"
                      }
                    >
                      {formatPercent(marginPct)} margin
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}