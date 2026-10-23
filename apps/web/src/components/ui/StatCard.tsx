import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export interface StatCardProps {
  label: string;
  value: string;
  helpText?: string;
  icon?: LucideIcon;
  className?: string;
}

/** Simpler, non-trend variant of KpiCard for counts (open approvals, low-stock items, active orders). */
export function StatCard({ label, value, helpText, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", className)}>
      {Icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </div>
      ) : null}
      <div>
        <p className="font-display text-xl font-semibold text-ink tabular-nums">{value}</p>
        <p className="text-xs text-ink-muted">{label}</p>
        {helpText ? <p className="text-[11px] text-ink-faint">{helpText}</p> : null}
      </div>
    </Card>
  );
}
