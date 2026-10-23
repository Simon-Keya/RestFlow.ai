"use client";

/**
 * Type-safe helpers for NewOrderPanel selection building.
 * Fixes: Type error 'o' is possibly 'undefined' (Netlify / next build).
 *
 * Apply either:
 * A) Replace the broken out.push block in NewOrderPanel.tsx, OR
 * B) Import buildChoiceSelection from this module.
 */

import type { MenuComponentLine } from "@/features/menu/types";
import type { ComponentSelectionInput } from "../api";

export type CartSelection = ComponentSelectionInput;

/** Required units for a component at a sold quantity. */
export function requiredUnits(component: MenuComponentLine, soldQty: number) {
  return (component.quantityRequired ?? 1) * soldQty;
}

/**
 * Build a CHOICE/OPTION selection from the first available option, if any.
 * Never reads properties of a possibly-undefined option without a guard.
 */
export function buildChoiceSelection(
  component: MenuComponentLine,
  soldQty: number,
  preferredOptionId?: string,
): CartSelection | null {
  const need = requiredUnits(component, soldQty);
  if (need <= 0) return null;

  const options =
    (component as { optionItems?: Array<{ finishedGoodId?: string; finishedGoodName?: string }> })
      .optionItems ??
    (component as { options?: Array<{ finishedGoodId?: string; finishedGoodName?: string }> })
      .options ??
    [];

  const o =
    (preferredOptionId
      ? options.find((x) => x.finishedGoodId === preferredOptionId)
      : undefined) ?? options[0];

  if (!o?.finishedGoodId) {
    // FIXED components may carry finishedGoodId on the component itself
    const fixedId = (component as { finishedGoodId?: string }).finishedGoodId;
    if (!fixedId) return null;
    return {
      component_key: component.componentKey,
      finished_good_id: fixedId,
      finished_good_name:
        (component as { finishedGoodName?: string }).finishedGoodName || fixedId,
      quantity: need,
    };
  }

  return {
    component_key: component.componentKey,
    finished_good_id: o.finishedGoodId,
    finished_good_name: o.finishedGoodName || o.finishedGoodId,
    quantity: need,
  };
}

/**
 * Drop-in replacement for the broken block:
 *
 *   const o = component.optionItems?.[0];
 *   out.push({
 *     component_key: component.componentKey,
 *     finished_good_id: o.finishedGoodId,  // ERROR: o possibly undefined
 *     finished_good_name: o.finishedGoodName || o.finishedGoodId,
 *     quantity: need,
 *   });
 *
 * Use:
 *
 *   const sel = buildChoiceSelection(component, line.quantity);
 *   if (sel) out.push(sel);
 */
export function pushChoiceSelection(
  out: CartSelection[],
  component: MenuComponentLine,
  soldQty: number,
): void {
  const sel = buildChoiceSelection(component, soldQty);
  if (sel) out.push(sel);
}
