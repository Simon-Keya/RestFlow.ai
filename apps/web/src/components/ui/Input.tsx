import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leadingIcon, ...props }, ref) => {
    if (leadingIcon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint">{leadingIcon}</span>
          <input
            ref={ref}
            className={cn(
              "h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint",
              "focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
              invalid && "border-danger-500 focus:border-danger-500 focus:ring-danger-100",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint",
          "focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
          invalid && "border-danger-500 focus:border-danger-500 focus:ring-danger-100",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
