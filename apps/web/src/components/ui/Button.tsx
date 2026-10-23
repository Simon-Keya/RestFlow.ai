"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600",
  secondary: "bg-surface border border-border text-ink hover:bg-surface-muted focus-visible:outline-primary-600",
  ghost: "bg-transparent text-ink hover:bg-surface-muted focus-visible:outline-primary-600",
  danger: "bg-danger-600 text-white hover:bg-danger-700 focus-visible:outline-danger-600",
  link: "bg-transparent text-primary-600 underline-offset-4 hover:underline p-0 h-auto",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        // Radix's Slot merges this onto the single child element; for non-button children
        // (e.g. `asChild` wrapping a Link) that's harmless, but only apply it for real buttons
        // to avoid an invalid `disabled` attribute ending up on an anchor.
        {...(!asChild ? { disabled: isDisabled } : {})}
        aria-disabled={asChild ? isDisabled : undefined}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          isDisabled && asChild && "pointer-events-none opacity-50",
          VARIANTS[variant],
          variant !== "link" && SIZES[size],
          className,
        )}
        {...props}
      >
        {/* Slot (asChild) requires exactly one child element — a single conditional
            expression here, never two sibling expressions, keeps that true either way. */}
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
