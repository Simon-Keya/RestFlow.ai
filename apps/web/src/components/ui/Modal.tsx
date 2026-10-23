"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Header + footer stay visible; only the middle body scrolls.
 * Critical for POS "Add item" when menu has many lines.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col",
            "max-h-[min(90vh,720px)] animate-slide-up",
            "rounded-lg border border-border bg-surface shadow-popover",
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-sm font-semibold text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-ink-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="rounded p-1 text-ink-faint transition hover:bg-surface-muted hover:text-ink">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {children}
          </div>
          {footer ? (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
