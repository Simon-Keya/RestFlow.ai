import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

const TONES = {
  info: { className: "border-border bg-surface-muted text-ink", Icon: Info },
  success: { className: "border-success-200 bg-success-50 text-success-600", Icon: CheckCircle2 },
  warning: { className: "border-warning-200 bg-warning-50 text-warning-700", Icon: AlertTriangle },
  danger: { className: "border-danger-200 bg-danger-50 text-danger-700", Icon: XCircle },
} as const;

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof TONES;
  title: string;
  description?: string;
}

export function Alert({ tone = "info", title, description, className, ...props }: AlertProps) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-md border p-3", toneClass, className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-0.5 text-xs opacity-90">{description}</p> : null}
      </div>
    </div>
  );
}
