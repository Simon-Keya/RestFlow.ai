"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function Checkbox({ checked, onCheckedChange, disabled, id, ...props }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(state) => onCheckedChange(state === true)}
      disabled={disabled}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border border-border-strong bg-surface",
        "data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
