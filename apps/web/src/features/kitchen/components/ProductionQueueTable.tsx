// apps/web/src/features/kitchen/components/ProductionQueueTable.tsx
"use client";

import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format/dates";
import { Utensils } from "lucide-react";
import type { ProductionQueueItem } from "../types";

export function ProductionQueueTable({
  queue,
  onFinishRequest,
}: {
  queue: ProductionQueueItem[];
  /** Opens finish modal with Standard | Actual lines */
  onFinishRequest: (item: ProductionQueueItem) => void;
}) {
  const list = queue ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Utensils}
        title="No batches in production"
        description="Start a batch from a recipe to see it here."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Recipe</TableHeaderCell>
          <TableHeaderCell className="text-right">Batch size</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Started</TableHeaderCell>
          <TableHeaderCell />
        </tr>
      </TableHead>
      <TableBody>
        {list.map((item) => (
          <TableRow key={item.productionId}>
            <TableCell className="font-medium">{item.recipeName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {item.batchSize}
            </TableCell>
            <TableCell>
              <Badge tone={item.status === "started" ? "warning" : "success"}>
                {item.status === "started" ? "In progress" : "Finished"}
              </Badge>
            </TableCell>
            <TableCell className="text-ink-faint">
              {formatDateTime(item.startedAt)}
            </TableCell>
            <TableCell>
              {item.status === "started" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onFinishRequest(item)}
                >
                  Finish batch
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}