"use client";

import { useState } from "react";
import {
  Table,
  TableHead,
  TableBody,
  TableHeaderCell,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardCheck } from "lucide-react";
import { ClosingStockRow } from "./ClosingStockRow";
import { ApiError } from "@/lib/api/errors";
import type { ClosingStockEntry } from "../types";
import type { ClosingStockSubmission } from "../schema";

export function ClosingStockForm({
  entries,
  onSubmit,
  isSubmitting,
  error,
  canSubmit = true,
}: {
  entries: ClosingStockEntry[];
  onSubmit: (submission: ClosingStockSubmission) => void;
  isSubmitting: boolean;
  error: unknown;
  /** When false, counts are view-only and submit is hidden (KITCHEN / unauthorized). */
  canSubmit?: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No closing stock items due"
        description="Check back at end of shift."
      />
    );
  }

  const completedCount = entries.filter((e) => counts[e.itemId]?.trim()).length;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      entries: entries
        .filter((e) => counts[e.itemId]?.trim())
        .map((e) => ({
          itemId: e.itemId,
          countedQuantity: Number(counts[e.itemId]),
        })),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error instanceof ApiError ? (
        <Alert
          tone="danger"
          title="Couldn't submit closing stock"
          description={error.message}
        />
      ) : null}

      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Item</TableHeaderCell>
            <TableHeaderCell className="text-right">Expected</TableHeaderCell>
            <TableHeaderCell className="text-right">Counted</TableHeaderCell>
            <TableHeaderCell className="text-right">Variance</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <ClosingStockRow
              key={entry.itemId}
              entry={entry}
              value={counts[entry.itemId] ?? ""}
              onChange={(value) =>
                setCounts({ ...counts, [entry.itemId]: value })
              }
              readOnly={!canSubmit}
            />
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-xs text-ink-muted">
          {canSubmit
            ? `${completedCount} of ${entries.length} counted`
            : `${entries.length} items · submission restricted to admin/manager`}
        </p>
        {canSubmit ? (
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={completedCount === 0}
          >
            Submit closing stock
          </Button>
        ) : null}
      </div>
    </div>
  );
}
