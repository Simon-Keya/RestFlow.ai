// apps/web/src/features/waste/components/WastePage.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, PackageMinus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

import { useWasteDashboard } from "../hooks/use-waste-dashboard";
import { wasteApi } from "../api";
import { inventoryApi } from "@/features/inventory/api";
import { recordWasteSchema, type RecordWasteInput } from "../schema";
import { WASTE_CAUSE_LABELS } from "../constants";
import { WasteSummaryCards } from "./WasteSummaryCards";
import { WasteByCauseTable } from "./WasteByCauseTable";
import { TopWastedItemsTable } from "./TopWastedItemsTable";
import { WasteCauseBadge } from "./WasteCauseBadge";
import { WasteSkeleton } from "./WasteSkeleton";
import { PeriodFilter } from "@/features/dashboard/components/PeriodFilter";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { formatRelativeTime } from "@/lib/format/dates";
import { routes } from "@/lib/routes";
import { useToast } from "@/providers/ToastProvider";
import { ApiError } from "@/lib/api/errors";

function LogWasteModal({
  shopId,
  open,
  onOpenChange,
}: {
  shopId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    item_id: "",
    quantity: "",
    waste_reason: "expired",
    notes: "",
    batch_id: "",
    unit_of_measure: "pcs",
  });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const batchQuery = useQuery({
    queryKey: ["inventory", "batches", shopId, form.item_id],
    queryFn: () => inventoryApi.getBatches(form.item_id.trim(), shopId),
    enabled: open && form.item_id.trim().length > 0,
  });
  const batches = batchQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: (input: RecordWasteInput) => wasteApi.recordWaste(input),
    onSuccess: () => {
      toast({ title: "Waste recorded", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["waste"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
      setForm({
        item_id: "",
        quantity: "",
        waste_reason: "expired",
        notes: "",
        batch_id: "",
        unit_of_measure: "pcs",
      });
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't record this."),
  });

  function handleSubmit() {
    const result = recordWasteSchema.safeParse(form);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Check the form and try again.",
      );
      return;
    }
    setError(null);
    mutation.mutate(result.data);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Log waste"
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSubmit}
            loading={mutation.isPending}
          >
            Record waste
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <Alert tone="danger" title={error} /> : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Item ID / SKU
          </label>
          <Input
            value={form.item_id}
            onChange={(e) => setForm({ ...form, item_id: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Stock batch (optional)</label>
          <Select
            value={form.batch_id}
            onValueChange={(value) => setForm({ ...form, batch_id: value, unit_of_measure: batches.find((batch) => batch.id === value)?.unit ?? form.unit_of_measure })}
            options={[{ value: "", label: "Allocate FEFO automatically" }, ...batches.filter((batch) => (batch.remainingQuantity ?? 0) > 0).map((batch) => ({ value: batch.id, label: `${batch.batchNumber} · ${batch.remainingQuantity ?? batch.quantity} ${batch.unit ?? "units"}${batch.expiryDate ? ` · exp ${new Date(batch.expiryDate).toLocaleDateString()}` : ""}` }))]}
          />
          {form.batch_id ? <p className="mt-1 text-xs text-ink-muted">Waste will be deducted from this batch only.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Quantity
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Cause
            </label>
            <Select
              value={form.waste_reason}
              onValueChange={(v) => setForm({ ...form, waste_reason: v })}
              options={Object.entries(WASTE_CAUSE_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Notes (optional)
          </label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
}

export function WastePage({ shopId }: { shopId: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [writeOffPreviewOpen, setWriteOffPreviewOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { summary, events, period, setPeriod, setRange } =
    useWasteDashboard(shopId);
  const expiredCandidates = useQuery({
    queryKey: ["waste", "expired-candidates", shopId],
    queryFn: () => wasteApi.listExpiredCandidates(shopId),
    enabled: writeOffPreviewOpen,
  });

  const writeOff = useMutation({
    mutationFn: () => wasteApi.writeOffExpired(shopId),
    onSuccess: (res) => {
      toast({
        title: "Expired write-off",
        description: res.message,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["waste"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({
        queryKey: ["inventory", "summary"],
      });
    },
    onError: (err) => {
      toast({
        title: "Write-off failed",
        description: err instanceof ApiError ? err.message : "Try again",
        variant: "danger",
      });
    },
  });

  if (summary.isPending) return <WasteSkeleton />;

  if (summary.isError) {
    return (
      <ErrorState
        title="Couldn't load waste data"
        description={summary.error.message}
        onRetry={summary.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Waste"
        description="Track spoilage, prep errors, and write-offs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter
              value={period}
              onPresetChange={setPeriod}
              onRangeChange={setRange}
            />
            <Button
              variant="secondary"
              onClick={() => setWriteOffPreviewOpen(true)}
              loading={writeOff.isPending}
            >
              Write off expired stock
            </Button>
            <Button variant="danger" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Log waste
            </Button>
          </div>
        }
      />

      <WasteSummaryCards summary={summary.data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WasteByCauseTable byCause={summary.data.byCause} />
        <TopWastedItemsTable shopId={shopId} items={summary.data.topItems} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent waste events</CardTitle>
        </CardHeader>
        {!events.data || events.data.items.length === 0 ? (
          <EmptyState icon={PackageMinus} title="No waste events yet" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Item</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Quantity
                </TableHeaderCell>
                <TableHeaderCell>Cause</TableHeaderCell>
                <TableHeaderCell>Batch</TableHeaderCell>
                <TableHeaderCell className="text-right">Value</TableHeaderCell>
                <TableHeaderCell>Reported by</TableHeaderCell>
                <TableHeaderCell>When</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {events.data.items.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Link
                      href={routes.wasteEvent(shopId, event.id)}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {event.itemName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(event.quantity, event.unit)}
                  </TableCell>
                  <TableCell>
                    <WasteCauseBadge cause={event.cause} />
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {event.batchNumber ? (
                      <Link
                        href={routes.traceSearch(shopId, {
                          batchNumber: event.batchNumber,
                        })}
                        className="hover:underline"
                      >
                        {event.batchNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(event.value)}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {event.reportedBy}
                  </TableCell>
                  <TableCell className="text-ink-faint">
                    {formatRelativeTime(event.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={writeOffPreviewOpen}
        onOpenChange={setWriteOffPreviewOpen}
        title="Review expired stock write-off"
        description="Only expired batches with remaining stock will be written off. In-date batches are not affected."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setWriteOffPreviewOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={writeOff.isPending} disabled={expiredCandidates.isLoading || !(expiredCandidates.data?.length)} onClick={() => writeOff.mutate(undefined, { onSuccess: () => setWriteOffPreviewOpen(false) })}>Confirm write-off</Button>
          </>
        }
      >
        {expiredCandidates.isLoading ? <p className="text-sm text-ink-muted">Loading expired batches…</p> : expiredCandidates.isError ? <Alert tone="danger" title="Could not load expired batches. Close and try again." /> : !expiredCandidates.data?.length ? <EmptyState icon={PackageMinus} title="No expired batches" description="There are no expired batches with remaining stock to write off." /> : <div className="flex flex-col gap-3">
          <div className="text-sm font-medium">{expiredCandidates.data.length} batch(es) · {formatCurrency(expiredCandidates.data.reduce((sum, row) => sum + Number(row.batch_value ?? 0), 0))} at risk</div>
          <div className="max-h-72 overflow-auto rounded-md border border-border"><Table><TableHead><tr><TableHeaderCell>Item / batch</TableHeaderCell><TableHeaderCell>Expiry</TableHeaderCell><TableHeaderCell className="text-right">Quantity</TableHeaderCell><TableHeaderCell className="text-right">Value</TableHeaderCell></tr></TableHead><TableBody>{expiredCandidates.data.map((row, index) => <TableRow key={String(row.batch_id ?? index)}><TableCell>{String(row.item_name ?? row.item_id)}<div className="text-xs text-ink-muted">{String(row.batch_number ?? row.batch_id)}</div></TableCell><TableCell>{row.expiry_date ? new Date(String(row.expiry_date)).toLocaleDateString() : "—"}</TableCell><TableCell className="text-right">{formatQuantity(Number(row.write_off_qty ?? 0), String(row.unit ?? "pcs"))}</TableCell><TableCell className="text-right">{formatCurrency(Number(row.batch_value ?? 0))}</TableCell></TableRow>)}</TableBody></Table></div>
        </div>}
      </Modal>
      <LogWasteModal shopId={shopId} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
