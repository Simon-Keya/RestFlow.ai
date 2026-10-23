"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Right-hand slide-over, used for record detail panels (order detail, waste event, batch review). */
export function Drawer({ open, onOpenChange, title, description, children, footer, className }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-popover",
            "animate-slide-up",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-sm font-semibold text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-xs text-ink-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close className="rounded p-1 text-ink-faint transition hover:bg-surface-muted hover:text-ink">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
