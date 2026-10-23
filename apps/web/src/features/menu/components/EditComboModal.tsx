"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

export type ComboEdit = {
  comboId: string;
  name: string;
  sellingPrice: number;
  active: boolean;
};

type Props = {
  combo: ComboEdit | null;
  open: boolean;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    selling_price: number;
    active: boolean;
  }) => Promise<void>;
};

/** ADMIN-only edit for existing combo name / price / active. */
export function EditComboModal({ combo, open, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (combo && open) {
      setName(combo.name);
      setPrice(String(combo.sellingPrice));
      setActive(combo.active);
      setError(null);
    }
  }, [combo, open]);

  if (!open || !combo) return null;

  async function handleSave() {
    setError(null);
    const selling_price = Number(price);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!Number.isFinite(selling_price) || selling_price < 0) {
      setError("Price must be a valid number");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        selling_price,
        active,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-lg font-semibold text-ink">Edit combo</h2>
        <p className="mt-1 text-xs text-ink-muted">ID: {combo.comboId}</p>

        {error ? (
          <div className="mt-3">
            <Alert tone="danger" title="Could not save" description={error} />
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-ink">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />

        <label className="mt-3 block text-sm font-medium text-ink">
          Selling price (Ksh)
        </label>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          min={0}
          step="0.01"
          className="mt-1"
        />

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={busy}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
