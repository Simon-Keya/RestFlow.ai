// apps/web/src/features/approvals/components/ApprovalsPage.tsx
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePendingApprovals } from "../hooks/use-pending-approvals";
import { approvalsApi } from "../api";
import { ApprovalsTable } from "./ApprovalsTable";
import { ApprovalsSkeleton } from "./ApprovalsSkeleton";
import { useToast } from "@/providers/ToastProvider";

export function ApprovalsPage({ shopId }: { shopId: string }) {
  const approvals = usePendingApprovals(shopId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["approvals", "pending", shopId],
    });

  const approve = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      toast({ title: "Request approved", variant: "success" });
      invalidate();
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      approvalsApi.reject(id, "Rejected from web console"),
    onSuccess: () => {
      toast({ title: "Request rejected", variant: "default" });
      invalidate();
    },
  });

  if (approvals.isPending) return <ApprovalsSkeleton />;

  if (approvals.isError) {
    return (
      <ErrorState
        title="Couldn't load approvals"
        description={approvals.error.message}
        onRetry={approvals.refetch}
      />
    );
  }

  const list = Array.isArray(approvals.data) ? approvals.data : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description="Write-offs, adjustments, and refunds waiting for sign-off."
      />
      <Card>
        <ApprovalsTable
          approvals={list}
          onApprove={(id) => approve.mutate(id)}
          onReject={(id) => reject.mutate(id)}
          isMutating={approve.isPending || reject.isPending}
        />
      </Card>
    </div>
  );
}
