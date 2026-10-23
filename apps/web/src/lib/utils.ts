/** Small, dependency-free helpers shared across features. */

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item);
      (acc[key] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function sumBy<T>(
  items: T[],
  selector: (item: T) => number | undefined | null,
) {
  return items.reduce(
    (total, item) => total + (Number(selector(item)) || 0),
    0,
  );
}

export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(value: string | null | undefined, max: number) {
  if (value == null) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Title-case a snake_case / kebab-case identifier for display.
 * Safe with null/undefined/non-string values.
 */
export function humanize(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";

  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Unwrap common API list envelopes to a plain array. */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.orders)) return obj.orders as T[];
    if (Array.isArray(obj.queue)) return obj.queue as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}