"use client";

import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import type { PeriodRange, PeriodPreset } from "@/lib/constants/period";

export function PeriodFilter({
  value,
  onPresetChange,
  onRangeChange,
}: {
  value: PeriodRange;
  onPresetChange: (preset: PeriodPreset) => void;
  onRangeChange: (range: PeriodRange) => void;
}) {
  return (
    <DateRangeFilter
      value={value}
      onChange={(next) => {
        if (next.preset !== value.preset) onPresetChange(next.preset);
        else onRangeChange(next);
      }}
    />
  );
}
