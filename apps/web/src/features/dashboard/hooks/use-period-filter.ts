"use client";

import { useCallback, useMemo, useState } from "react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";
import type { PeriodPreset, PeriodRange } from "@/lib/constants/period";

function rangeForPreset(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date();
  const to = format(today, "yyyy-MM-dd");

  switch (preset) {
    case "today":
      return { from: to, to };
    case "yesterday": {
      const y = subDays(today, 1);
      const d = format(y, "yyyy-MM-dd");
      return { from: d, to: d };
    }
    case "this_week":
      return {
        from: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to,
      };
    case "last_week": {
      const last = subWeeks(today, 1);
      return {
        from: format(startOfWeek(last, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(last, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    case "this_month":
    case "mtd":
      return { from: format(startOfMonth(today), "yyyy-MM-dd"), to };
    case "last_month": {
      const lm = subMonths(today, 1);
      return {
        from: format(startOfMonth(lm), "yyyy-MM-dd"),
        to: format(endOfMonth(lm), "yyyy-MM-dd"),
      };
    }
    case "this_year":
      return { from: format(startOfYear(today), "yyyy-MM-dd"), to };
    case "7d":
      return { from: format(subDays(today, 6), "yyyy-MM-dd"), to };
    case "30d":
      return { from: format(subDays(today, 29), "yyyy-MM-dd"), to };
    case "custom":
    default:
      return { from: format(subDays(today, 29), "yyyy-MM-dd"), to };
  }
}

export function usePeriodFilter(initial: PeriodPreset = "today") {
  const initialRange = useMemo(() => rangeForPreset(initial), [initial]);
  const [period, setPeriodState] = useState<PeriodRange>({
    preset: initial,
    ...initialRange,
  });

  const setPeriod = useCallback((preset: PeriodPreset) => {
    const r = rangeForPreset(preset);
    setPeriodState({ preset, ...r });
  }, []);

  const setRange = useCallback((range: PeriodRange) => {
    setPeriodState(range);
  }, []);

  return { period, setPeriod, setRange };
}
