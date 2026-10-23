"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onValueChange, options, placeholder = "Select…", className, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-ink",
          "focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
          "disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-ink-faint",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border border-border bg-surface shadow-popover"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded px-6 py-1.5 text-sm text-ink outline-none",
                  "data-[highlighted]:bg-surface-muted",
                )}
              >
                <RadixSelect.ItemIndicator className="absolute left-1.5">
                  <Check className="h-3.5 w-3.5 text-primary-600" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
