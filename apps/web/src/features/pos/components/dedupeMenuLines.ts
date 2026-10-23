import type { MenuComponentLine } from "@/features/menu/types";

/**
 * POS Add-to-cart was rendering each FIXED inventory component twice when the
 * menu payload (or client merge) repeated the same finishedGoodId / componentKey.
 * Deduplicate for *display* only — do not change sale deduction logic.
 */
export function dedupeMenuLines(lines: MenuComponentLine[]): MenuComponentLine[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const seenKeys = new Set<string>();
  const seenItemIds = new Set<string>();
  const out: MenuComponentLine[] = [];

  for (const line of lines) {
    if (!line) continue;
    const itemId = (line.finishedGoodId || "").trim();
    const key = (line.componentKey || "").trim() || `idx-${out.length}`;

    // Prefer unique by inventory/FG id for FIXED / INVENTORY
    if (itemId) {
      if (seenItemIds.has(itemId)) continue;
      seenItemIds.add(itemId);
    } else if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    out.push(line);
  }

  return out;
}
