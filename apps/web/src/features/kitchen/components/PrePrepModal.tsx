"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/providers/ToastProvider";
import { ApiError } from "@/lib/api/errors";
import { kitchenApi } from "../api";
import { prePrepSchema, type PrePrepInput } from "../schema";

const LOSS_REASONS = [
  { value: "thaw_drip", label: "Thaw drip" },
  { value: "peel", label: "Peel" },
  { value: "trim", label: "Trim" },
  { value: "bone_skin", label: "Bone / skin" },
  { value: "spoiled_on_prep", label: "Spoiled on prep" },
  { value: "other", label: "Other" },
];

export function PrePrepModal({
  open,
  onOpenChange,
  shopId,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string;
  onCompleted: () => void;
}) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    raw_item_id: "",
    prepped_item_id: "",
    prepped_item_name: "",
    original_qty: "",
    yielded_qty: "",
    loss_reason: "" as string,
    note: "",
    unit: "kg",
    method: "",
  });

  const original = Number(form.original_qty) || 0;
  const yielded = Number(form.yielded_qty) || 0;
  const lost = useMemo(() => {
    if (!(original > 0) || !(yielded > 0) || yielded > original) return null;
    return Math.round((original - yielded) * 1000) / 1000;
  }, [original, yielded]);
  const lossPct = useMemo(() => {
    if (lost == null || !(original > 0)) return null;
    return Math.round((lost / original) * 1000) / 10;
  }, [lost, original]);

  const mutation = useMutation({
    mutationFn: (input: PrePrepInput) => kitchenApi.submitPrePrep(shopId, input),
    onSuccess: (res) => {
      toast({
        title: "Pre-prep completed",
        description: `Lost ${res.lost_qty} (${res.loss_pct}%). Prepped unit cost ${res.prepped_unit_cost}`,
        variant: "success",
      });
      onCompleted();
      onOpenChange(false);
      setForm({
        raw_item_id: "",
        prepped_item_id: "",
        prepped_item_name: "",
        original_qty: "",
        yielded_qty: "",
        loss_reason: "",
        note: "",
        unit: "kg",
        method: "",
      });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't complete pre-prep."),
  });

  function handleSubmit() {
    const result = prePrepSchema.safeParse({
      raw_item_id: form.raw_item_id.trim(),
      prepped_item_id: form.prepped_item_id.trim(),
      prepped_item_name: form.prepped_item_name.trim() || undefined,
      original_qty: form.original_qty,
      yielded_qty: form.yielded_qty,
      loss_reason: form.loss_reason || undefined,
      note: form.note.trim() || undefined,
      unit: form.unit || "kg",
      method: form.method.trim() || undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }
    setError(null);
    mutation.mutate(result.data);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Pre-prep batch"
      description="Deducts raw original weight, records lost weight as pre-prep waste, and creates a prepped finished-good lot. Lost weight is calculated by the system."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={mutation.isPending}>
            Complete pre-prep
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <Alert tone="danger" title={error} /> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Raw item ID (SKU)
            </label>
            <Input
              value={form.raw_item_id}
              onChange={(e) => setForm({ ...form, raw_item_id: e.target.value })}
              placeholder="e.g. CHICKEN-BREAST-FROZEN"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Prepped item ID (SKU)
            </label>
            <Input
              value={form.prepped_item_id}
              onChange={(e) => setForm({ ...form, prepped_item_id: e.target.value })}
              placeholder="e.g. CHICKEN-BREAST-PREPPED"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Prepped item name (optional)
          </label>
          <Input
            value={form.prepped_item_name}
            onChange={(e) => setForm({ ...form, prepped_item_name: e.target.value })}
            placeholder="Chicken breast (thawed/trimmed)"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Original qty
            </label>
            <Input
              type="number"
              step="0.001"
              value={form.original_qty}
              onChange={(e) => setForm({ ...form, original_qty: e.target.value })}
              placeholder="10.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Yielded qty
            </label>
            <Input
              type="number"
              step="0.001"
              value={form.yielded_qty}
              onChange={(e) => setForm({ ...form, yielded_qty: e.target.value })}
              placeholder="8.20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Lost qty (system)
            </label>
            <Input
              value={lost == null ? "—" : String(lost)}
              readOnly
              className="bg-surface-muted"
            />
          </div>
        </div>

        <p className="text-xs text-ink-muted">
          {lossPct != null
            ? `Loss ${lossPct}% · Original = Yielded + Lost`
            : "Enter original and yielded weights. Lost is calculated automatically."}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Loss reason {lost != null && lost > 0 ? "(required)" : "(optional)"}
            </label>
            <Select
              value={form.loss_reason}
              onValueChange={(value) => setForm({ ...form, loss_reason: value })}
              options={LOSS_REASONS}
              placeholder="Select reason"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Unit</label>
            <Input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="kg"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Method / note</label>
          <Input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. overnight thaw"
          />
        </div>
      </div>
    </Modal>
  );
}
