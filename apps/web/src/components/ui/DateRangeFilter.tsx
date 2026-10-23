"use client";

import { Calendar } from "lucide-react";
import { Select } from "./Select";
import { Input } from "./Input";
import { PERIOD_PRESETS, type PeriodRange } from "@/lib/constants/period";

export interface DateRangeFilterProps {
  value: PeriodRange;
  onChange: (value: PeriodRange) => void;
}

/** Preset dropdown (Today / 7d / 30d / MTD) that expands into two date inputs for "Custom range". */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-ink-faint" aria-hidden />
      <Select
        value={value.preset}
        onValueChange={(preset) => onChange({ ...value, preset: preset as PeriodRange["preset"] })}
        options={PERIOD_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        className="w-40"
      />
      {value.preset === "custom" ? (
        <>
          <Input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-36"
          />
          <span className="text-ink-faint">–</span>
          <Input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-36"
          />
        </>
      ) : null}
    </div>
  );
}
