export const PERIOD_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "Month to date" },
  { value: "custom", label: "Custom range" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["value"];

export interface PeriodRange {
  preset: PeriodPreset;
  from: string;
  to: string;
}
