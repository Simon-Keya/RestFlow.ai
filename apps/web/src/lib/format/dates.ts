import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";

function toDate(value: string | number | Date): Date {
  return typeof value === "string" ? parseISO(value) : new Date(value);
}

/** Short date for tables, e.g. "12 Jan 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return format(toDate(value), "d MMM yyyy");
}

/** Date + time for event/audit trails, e.g. "12 Jan 2026, 14:32". */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return format(toDate(value), "d MMM yyyy, HH:mm");
}

/** Relative time for recent activity feeds, e.g. "3 minutes ago". Falls back to a full date past 7 days. */
export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days > 7) return formatDate(date);
  if (isToday(date)) return `Today, ${format(date, "HH:mm")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "HH:mm")}`;
  return formatDistanceToNow(date, { addSuffix: true });
}

/** Days remaining until an expiry date; negative once past due. */
export function daysUntil(value: string | number | Date | null | undefined): number | null {
  if (!value) return null;
  const date = toDate(value);
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}
