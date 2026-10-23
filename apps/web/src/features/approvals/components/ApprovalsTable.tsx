// apps/web/src/features/approvals/components/ApprovalsTable.tsx
"use client";

import { useState } from "react";
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatCurrency } from "@/lib/format/currency";
import { formatRelativeTime } from "@/lib/format/dates";
import { humanize } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import type { PendingApproval } from "../types";

export interface ApprovalsTableProps {
  approvals: PendingApproval[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isMutating: boolean;
}

export function ApprovalsTable({
  approvals,
  onApprove,
  onReject,
  isMutating,
}: ApprovalsTableProps) {
  const [rejectTarget, setRejectTarget] = useState<PendingApproval | null>(
    null,
  );
  const list = Array.isArray(approvals) ? approvals : [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing pending approval"
        description="Requests for write-offs, adjustments, and refunds show up here."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Summary</TableHeaderCell>
            <TableHeaderCell className="text-right">Amount</TableHeaderCell>
            <TableHeaderCell>Requested by</TableHeaderCell>
            <TableHeaderCell>When</TableHeaderCell>
            <TableHeaderCell />
          </tr>
        </TableHead>
        <TableBody>
          {list.map((approval) => (
            <TableRow key={approval.id}>
              <TableCell>
                <Badge tone="warning">{humanize(approval.type)}</Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {approval.summary}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(approval.amount)}
              </TableCell>
              <TableCell className="text-ink-muted">
                {approval.requestedBy}
              </TableCell>
              <TableCell className="text-ink-faint">
                {formatRelativeTime(approval.requestedAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRejectTarget(approval)}
                    disabled={isMutating}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onApprove(approval.id)}
                    loading={isMutating}
                  >
                    Approve
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject this request?"
        description={rejectTarget?.summary}
        confirmLabel="Reject"
        tone="danger"
        loading={isMutating}
        onConfirm={() => {
          if (rejectTarget) onReject(rejectTarget.id);
          setRejectTarget(null);
        }}
      />
    </>
  );
}
