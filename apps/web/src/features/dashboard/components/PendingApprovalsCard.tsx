import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format/currency";
import { formatRelativeTime } from "@/lib/format/dates";
import { humanize } from "@/lib/utils";
import { routes } from "@/lib/routes";
import type { PendingApproval } from "../types";

export function PendingApprovalsCard({ shopId, approvals }: { shopId: string; approvals: PendingApproval[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending approvals</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {approvals.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nothing waiting on you" description="Approvals for write-offs, adjustments, and refunds show up here." />
        ) : (
          <ul className="divide-y divide-border">
            {approvals.slice(0, 5).map((approval) => (
              <li key={approval.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{humanize(approval.type)}</Badge>
                    <p className="truncate text-sm text-ink">{approval.summary}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {approval.requestedBy} · {formatRelativeTime(approval.requestedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatCurrency(approval.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {approvals.length > 0 ? (
        <CardFooter>
          <Button asChild variant="secondary" size="sm">
            <Link href={routes.approvals(shopId)}>Review all ({approvals.length})</Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
