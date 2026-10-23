"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { REASON_CODE_LABELS } from "../constants";
import { ApiError } from "@/lib/api/errors";
import type { VarianceLine } from "../types";
import type { ReasonCodeInput } from "../schema";

export function ReasonCodeForm({
  line,
  onSubmit,
  isSubmitting,
  error,
}: {
  line: VarianceLine;
  onSubmit: (input: ReasonCodeInput) => void;
  isSubmitting: boolean;
  error: unknown;
}) {
  const [reasonCode, setReasonCode] = useState(line.reasonCode ?? "miscount");
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted/40 p-4">
      <p className="text-sm font-medium text-ink">
        Explain the variance on <span className="font-semibold">{line.itemName}</span>
      </p>
      {error instanceof ApiError ? <Alert tone="danger" title={error.message} /> : null}
      <Select value={reasonCode} onValueChange={setReasonCode} options={Object.entries(REASON_CODE_LABELS).map(([value, label]) => ({ value, label }))} />
      <Textarea placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <div className="flex justify-end">
        <Button
          size="sm"
          loading={isSubmitting}
          onClick={() => onSubmit({ itemId: line.itemId, reasonCode: reasonCode as ReasonCodeInput["reasonCode"], note })}
        >
          Save reason
        </Button>
      </div>
    </div>
  );
}
