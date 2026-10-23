import { AlertCircle } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = "Couldn't load this", description, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-danger-50">
        <AlertCircle className="h-5 w-5 text-danger-600" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
