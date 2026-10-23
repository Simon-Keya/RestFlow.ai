import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

const TONES = {
  neutral: "bg-surface-muted text-ink-muted border-border",
  primary: "bg-primary-50 text-primary-700 border-primary-200",
  success: "bg-success-50 text-success-600 border-success-200",
  warning: "bg-warning-50 text-warning-700 border-warning-200",
  danger: "bg-danger-50 text-danger-700 border-danger-200",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TONES;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
