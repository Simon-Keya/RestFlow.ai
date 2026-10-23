import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export interface KpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  deltaLabel?: string;
  deltaDirection?: "up" | "down" | "flat";
  /** Whether an "up" delta is good news (revenue) or bad news (food cost %, waste). */
  positiveDirection?: "up" | "down";
  tone?: "neutral" | "warning" | "danger" | "success";
}

const TONE_ACCENT: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-ink",
  warning: "text-warning-600",
  danger: "text-danger-600",
  success: "text-success-600",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  deltaLabel,
  deltaDirection = "flat",
  positiveDirection = "up",
  tone = "neutral",
}: KpiCardProps) {
  const isGood = deltaDirection === positiveDirection;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-ink-faint" aria-hidden /> : null}
      </div>
      <p className={cn("mt-2 font-display text-2xl font-semibold tabular-nums", TONE_ACCENT[tone])}>{value}</p>
      {deltaLabel ? (
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            deltaDirection === "flat" ? "text-ink-faint" : isGood ? "text-success-600" : "text-danger-600",
          )}
        >
          {deltaDirection === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
          {deltaDirection === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
          <span>{deltaLabel}</span>
        </div>
      ) : null}
    </Card>
  );
}
