import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
        <Icon className="h-5 w-5 text-ink-faint" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
