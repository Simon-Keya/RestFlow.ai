"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToast, type Toast, type ToastVariant } from "@/providers/ToastProvider";
import { cn } from "@/lib/cn";

const ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border bg-surface text-ink",
  success: "border-success-200 bg-success-50 text-success-600",
  warning: "border-warning-200 bg-warning-50 text-warning-700",
  danger: "border-danger-200 bg-danger-50 text-danger-700",
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.variant];
  return (
    <div
      role="status"
      className={cn(
        "animate-slide-up pointer-events-auto flex w-80 items-start gap-3 rounded-md border p-3 shadow-popover",
        VARIANT_STYLES[toast.variant],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-xs opacity-80">{toast.description}</p> : null}
      </div>
      <button onClick={onDismiss} className="opacity-60 transition hover:opacity-100" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
