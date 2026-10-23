"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kitchenApi } from "../api";
import { formatCurrency } from "@/lib/format/currency";
import { formatRelativeTime } from "@/lib/format/dates";
import { humanize } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/ToastProvider";

function defaultExpiryPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function RefillDetailDrawer({
  shopId,
  requestId,
  open,
  onClose,
}: {
  shopId: string;
  requestId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ["refill", "detail", shopId, requestId],
    queryFn: () => kitchenApi.getRefillDetail(requestId!, shopId),
    enabled: open && !!requestId,
  });

  const d = detail.data;
  const alreadyIssued = d?.status === "issued";

  const [issuedQty, setIssuedQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!d || alreadyIssued) return;
    const qty = d.requestedQty != null && d.requestedQty > 0 ? d.requestedQty : 1;
    setIssuedQty(String(qty));
    setUnitCost(d.unitCost > 0 ? String(Number(d.unitCost.toFixed(4))) : "");
    setExpiryDate(d.nextExpiryDate || defaultExpiryPlusDays(14));
    setBatchNumber("");
    setNotes("");
    setFormError(null);
  }, [d, alreadyIssued, requestId]);

  const lineValue = useMemo(() => {
    const q = Number(issuedQty);
    const c = Number(unitCost);
    if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0 || c < 0) return 0;
    return q * c;
  }, [issuedQty, unitCost]);

  const issueMutation = useMutation({
    mutationFn: () => {
      const q = Number(issuedQty);
      const c = Number(unitCost);
      if (!Number.isFinite(q) || q <= 0) {
        throw new Error("Issued quantity must be greater than 0");
      }
      if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        throw new Error("Expiry date is required (YYYY-MM-DD)");
      }
      if (!Number.isFinite(c) || c < 0) {
        throw new Error("Unit cost must be 0 or greater");
      }
      return kitchenApi.issueRefill(requestId!, {
        shopId,
        approvedQty: q,
        issuedQty: q,
        unitCost: c,
        expiryDate,
        batchNumber: batchNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Refill issued", variant: "success" });
      void queryClient.invalidateQueries({
        queryKey: ["kitchen", "refills", shopId],
      });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({
        queryKey: ["refill", "detail", shopId, requestId],
      });
      onClose();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not issue refill";
      setFormError(message);
      toast({ title: message, variant: "danger" });
    },
  });

  if (!open || !requestId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {alreadyIssued ? "Refill detail" : "Issue refill"}
            </h2>
            <p className="break-all text-xs text-ink-muted">{requestId}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        {detail.isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : detail.isError ? (
          <p className="text-sm text-danger">Could not load this refill.</p>
        ) : d ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone={d.status === "issued" ? "success" : "warning"}>
                {humanize(d.status)}
              </Badge>
              <Badge tone="neutral">{humanize(d.source)}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 text-sm">
              <div className="col-span-2">
                <dt className="text-ink-muted">Item</dt>
                <dd className="font-medium">{d.itemName || d.itemId || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">On hand now</dt>
                <dd>
                  {d.availableStock ?? "—"} {d.unit}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Stock value now</dt>
                <dd>
                  {d.totalValue > 0 ? formatCurrency(d.totalValue) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Nearest expiry (current)</dt>
                <dd>
                  {d.nextExpiryDate ?? "—"}
                  {d.daysToExpiryMin != null
                    ? ` (${d.daysToExpiryMin}d)`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Est. unit cost</dt>
                <dd>
                  {d.unitCost > 0 ? formatCurrency(d.unitCost) : "—"}
                </dd>
              </div>
            </dl>

            {!alreadyIssued ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-ink-muted">
                  Existing stock stays on hand. This issue adds quantity and
                  value. Nearest expiry becomes the earlier of current stock and
                  this lot.
                </p>

                {formError ? (
                  <Alert tone="danger" title={formError} />
                ) : null}

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Issued quantity ({d.unit})
                  </label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={issuedQty}
                    onChange={(e) => setIssuedQty(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Unit cost
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="Cost per unit for this lot"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Line value (auto)
                  </label>
                  <p className="text-sm font-semibold tabular-nums text-ink">
                    {formatCurrency(lineValue)}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Expiry date (this lot) *
                  </label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Batch number (optional)
                  </label>
                  <Input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Auto if left blank"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Notes
                  </label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <Button
                  onClick={() => {
                    setFormError(null);
                    issueMutation.mutate();
                  }}
                  loading={issueMutation.isPending}
                >
                  Confirm issue
                </Button>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-ink-muted">Issued</dt>
                  <dd>{d.issuedQty ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Batch</dt>
                  <dd className="break-all">{d.batchNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Expiry</dt>
                  <dd>{d.expiryDate ?? "—"}</dd>
                </div>
              </dl>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Timeline</h3>
              {d.timeline.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {d.source === "low_stock"
                    ? "System suggestion — confirm issue to record history."
                    : "No events yet."}
                </p>
              ) : (
                <ul className="space-y-3 border-l border-border pl-3">
                  {d.timeline.map((ev, i) => (
                    <li key={`${ev.type}-${ev.at}-${i}`} className="text-sm">
                      <p className="font-medium">{humanize(ev.type)}</p>
                      <p className="text-xs text-ink-muted">
                        {formatRelativeTime(ev.at)}
                        {ev.quantity != null ? ` · qty ${ev.quantity}` : ""}
                        {ev.batchNumber ? ` · ${ev.batchNumber}` : ""}
                        {ev.expiryDate ? ` · exp ${ev.expiryDate}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}