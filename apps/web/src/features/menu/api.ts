// apps/web/src/features/menu/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type {
  ChoiceOption,
  ComponentType,
  MenuComponentLine,
  MenuItem,
} from "./types";
import type { CreateMenuInput } from "./schema";

function asComponentType(value: unknown): ComponentType {
  const t = String(value ?? "FIXED").toUpperCase();
  if (t === "CHOICE" || t === "MULTI_CHOICE" || t === "INVENTORY") return t as ComponentType;
  return "FIXED";
}

/** De-dupe component lines by finishedGoodId / componentKey (display + client state). */
function dedupeLines(lines: MenuComponentLine[]): MenuComponentLine[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: MenuComponentLine[] = [];
  for (const line of lines) {
    const id = (line.finishedGoodId || "").trim();
    const key = (line.componentKey || "").trim();
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    } else if (key && seenKeys.has(key)) {
      continue;
    }
    if (key) seenKeys.add(key);
    out.push(line);
  }
  return out;
}


function toOption(raw: Record<string, unknown>): ChoiceOption {
  return {
    finishedGoodId: String(raw.finishedGoodId ?? raw.finished_good_id ?? ""),
    finishedGoodName: String(
      raw.finishedGoodName ?? raw.finished_good_name ?? "",
    ),
    unit: String(raw.unit ?? "pcs"),
    availableStock: Number(raw.availableStock ?? raw.available_stock ?? 0),
    unitCost: Number(raw.unitCost ?? raw.unit_cost ?? 0),
    maxPortions: Number(raw.maxPortions ?? raw.max_portions ?? 0),
  };
}

function toLine(raw: Record<string, unknown>, idx: number): MenuComponentLine {
  const type = asComponentType(raw.componentType ?? raw.component_type);
  const options = asArray<Record<string, unknown>>(raw.options)
    .map(toOption)
    .filter((o) => o.finishedGoodId);

  const qty = Number(raw.quantityRequired ?? raw.quantity_required ?? 1);

  return {
    componentKey: String(
      raw.componentKey ?? raw.component_key ?? `line_${idx + 1}`,
    ),
    componentType: type,
    finishedGoodId: (raw.finishedGoodId ??
      raw.finished_good_id ??
      null) as string | null,
    finishedGoodName: (raw.finishedGoodName ??
      raw.finished_good_name ??
      null) as string | null,
    finishedGoodCategoryId: (raw.finishedGoodCategoryId ??
      raw.finished_good_category_id ??
      null) as string | null,
    finishedGoodCategoryCode: (raw.finishedGoodCategoryCode ??
      raw.finished_good_category_code ??
      null) as string | null,
    finishedGoodCategoryName: (raw.finishedGoodCategoryName ??
      raw.finished_good_category_name ??
      null) as string | null,
    quantityRequired: qty,
    unit: String(raw.unit ?? "pcs"),
    unitCost: Number(raw.unitCost ?? raw.unit_cost ?? 0),
    lineCost: Number(raw.lineCost ?? raw.line_cost ?? 0),
    minSelect: Number(
      raw.minSelect ?? raw.min_select ?? (type === "CHOICE" ? 1 : 0),
    ),
    maxSelect: Number(
      raw.maxSelect ?? raw.max_select ?? (type === "CHOICE" ? 1 : qty),
    ),
    allowRepeat: Boolean(
      raw.allowRepeat ?? raw.allow_repeat ?? type === "MULTI_CHOICE",
    ),
    availableStock: Number(raw.availableStock ?? raw.available_stock ?? 0),
    maxPortions: Number(raw.maxPortions ?? raw.max_portions ?? 0),
    options,
  };
}

function toMenuItem(raw: Record<string, unknown>): MenuItem {
  const linesRaw = asArray<Record<string, unknown>>(raw.lines);
  let lines = dedupeLines(linesRaw.map((row, idx) => toLine(row, idx)));

  if (lines.length === 0 && (raw.finishedGoodId || raw.finished_good_id)) {
    lines = [
      toLine(
        {
          component_key: "main",
          component_type: "FIXED",
          finished_good_id: raw.finishedGoodId ?? raw.finished_good_id,
          finished_good_name: raw.finishedGoodName ?? raw.finished_good_name,
          quantity_required: raw.quantityRequired ?? raw.quantity_required,
          unit: raw.unit,
          available_stock: raw.availableQuantity ?? raw.available_quantity,
          max_portions: raw.maxPortions ?? raw.max_portions,
          unit_cost: raw.unitCost ?? raw.unit_cost,
          line_cost: raw.foodCost ?? raw.food_cost,
        },
        0,
      ),
    ];
  }

  const sellingPrice = Number(raw.sellingPrice ?? raw.selling_price ?? 0);
  const unitCost = Number(
    raw.unitCost ?? raw.unit_cost ?? raw.foodCost ?? raw.food_cost ?? 0,
  );
  const foodCost = Number(raw.foodCost ?? raw.food_cost ?? unitCost);
  const margin = Number(raw.margin ?? sellingPrice - foodCost);
  const marginPercentRaw = raw.marginPercent ?? raw.margin_percent ?? null;
  const marginPercent =
    marginPercentRaw == null
      ? sellingPrice > 0
        ? margin / sellingPrice
        : null
      : Number(marginPercentRaw);

  const requiresSelection = Boolean(
    raw.requiresSelection ??
      raw.requires_selection ??
      lines.some((l) => l.componentType !== "FIXED"),
  );

  return {
    menuId: String(raw.menuId ?? raw.menu_id ?? ""),
    menuCode: String(raw.menuCode ?? raw.menu_code ?? ""),
    name: String(raw.name ?? ""),
    category: (raw.category as string | null) ?? null,
    sellingPrice,
    taxRate: Number(raw.taxRate ?? raw.tax_rate ?? 16),
    finishedGoodId: (raw.finishedGoodId ??
      raw.finished_good_id ??
      lines.find((l) => l.finishedGoodId)?.finishedGoodId ??
      null) as string | null,
    finishedGoodName: (raw.finishedGoodName ??
      raw.finished_good_name ??
      null) as string | null,
    quantityRequired: Number(
      raw.quantityRequired ?? raw.quantity_required ?? 1,
    ),
    unit: String(raw.unit ?? "pcs"),
    lines,
    isAvailable: Boolean(raw.isAvailable ?? raw.is_available ?? true),
    isVisible: Boolean(raw.isVisible ?? raw.is_visible ?? true),
    availableQuantity: Number(
      raw.availableQuantity ?? raw.available_quantity ?? 0,
    ),
    maxPortions: Number(raw.maxPortions ?? raw.max_portions ?? 0),
    unitCost,
    foodCost,
    margin,
    marginPercent,
    foodCostPercent:
      raw.foodCostPercent != null || raw.food_cost_percent != null
        ? Number(raw.foodCostPercent ?? raw.food_cost_percent)
        : sellingPrice > 0
          ? foodCost / sellingPrice
          : null,
    costMissing: Boolean(
      raw.costMissing ??
        raw.cost_missing ??
        (lines.length > 0 && foodCost <= 0),
    ),
    requiresSelection,
    status: String(raw.status ?? "active"),
    createdAt: (raw.createdAt ?? raw.created_at ?? null) as string | null,
  };
}

export type FinishedGoodOption = {
  itemId: string;
  name: string;
  unit: string;
  availableStock: number;
  category?: string | null;
};

export type FinishedGoodCategoryOption = {
  id: string;
  code: string;
  name: string;
  itemCount: number;
};

export const menuApi = {
  async list(shopId: string): Promise<MenuItem[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.menu.list}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.data ?? data,
      );
      return rows.map(toMenuItem).filter((m) => m.menuId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  /**
   * FIXED lines only — dedicated menu endpoint (not full inventory).
   */
  async listFinishedGoods(shopId: string): Promise<FinishedGoodOption[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.menu.finishedGoods}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.data ?? data,
      );

      return rows
        .map((raw) => ({
          itemId: String(raw.itemId ?? raw.item_id ?? ""),
          name: String(raw.name ?? ""),
          unit: String(raw.unit ?? "pcs"),
          availableStock: Number(
            raw.availableStock ?? raw.available_stock ?? 0,
          ),
          category: (raw.category as string | null | undefined) ?? null,
        }))
        .filter((r) => r.itemId)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw toApiError(error);
    }
  },

  async listFinishedGoodCategories(): Promise<FinishedGoodCategoryOption[]> {
    try {
      const { data } = await apiClient.get(
        endpoints.menu.finishedGoodCategories,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.data ?? data,
      );
      return rows
        .map((raw) => ({
          id: String(raw.id ?? ""),
          code: String(raw.code ?? ""),
          name: String(raw.name ?? raw.code ?? ""),
          itemCount: Number(raw.itemCount ?? raw.item_count ?? 0),
        }))
        .filter((c) => c.id || c.code);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async create(input: CreateMenuInput): Promise<void> {
    try {
      await apiClient.post(endpoints.menu.create, input);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async listCatalogItems(shopId: string) {
    try {
      const { data } = await apiClient.get(
        `${endpoints.menu.catalogItems}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<Record<string, unknown>>(root.items ?? data).map((r) => ({
        menuItemId: String(r.menuItemId ?? r.menu_item_id ?? ""),
        name: String(r.name ?? ""),
        productionType: String(r.productionType ?? r.production_type ?? "stocked") as
          | "recipe"
          | "stocked",
        recipeId: (r.recipeId ?? r.recipe_id ?? null) as string | null,
        stockItemId: (r.stockItemId ?? r.stock_item_id ?? null) as string | null,
        sellingPrice: Number(r.sellingPrice ?? r.selling_price ?? 0),
        active: r.active !== false,
      }));
    } catch (error) {
      throw toApiError(error);
    }
  },

  async createCatalogItem(input: {
    name: string;
    production_type: "recipe" | "stocked";
    recipe_id?: string;
    stock_item_id?: string;
    selling_price: number;
  }): Promise<void> {
    try {
      await apiClient.post(endpoints.menu.catalogItems, input);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async listCategories(shopId: string) {
    try {
      const { data } = await apiClient.get(
        `${endpoints.menu.categories}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<Record<string, unknown>>(root.items ?? data).map((r) => {
        const menuItems = asArray<Record<string, unknown>>(
          r.menuItems ?? r.menu_items,
        ).map((m) => ({
          menuItemId: String(m.menuItemId ?? m.menu_item_id ?? ""),
          name: String(m.name ?? ""),
        }));
        const menuItemIds = asArray<string>(
          r.menuItemIds ?? r.menu_item_ids,
        );
        const ids =
          menuItemIds.length > 0
            ? menuItemIds
            : menuItems.map((m) => m.menuItemId).filter(Boolean);
        return {
          categoryId: String(r.categoryId ?? r.category_id ?? ""),
          name: String(r.name ?? ""),
          menuItemIds: ids,
          menuItems:
            menuItems.length > 0
              ? menuItems
              : ids.map((id) => ({ menuItemId: id, name: id })),
          active: r.active !== false,
        };
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async createCategory(input: {
    name: string;
    menu_item_ids: string[];
    category_id?: string;
  }): Promise<void> {
    try {
      await apiClient.post(endpoints.menu.categories, {
        name: input.name,
        menu_item_ids: input.menu_item_ids,
        category_id: input.category_id,
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async listCombos(shopId: string) {
    try {
      const { data } = await apiClient.get(
        `${endpoints.menu.combos}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<Record<string, unknown>>(root.items ?? data).map((r) => ({
        comboId: String(r.comboId ?? r.combo_id ?? ""),
        name: String(r.name ?? ""),
        sellingPrice: Number(r.sellingPrice ?? r.selling_price ?? 0),
        selectionGroups: asArray<Record<string, unknown>>(
          r.selectionGroups ?? r.selection_groups,
        ).map((g, idx) => ({
          groupIndex: Number(g.groupIndex ?? g.group_index ?? idx),
          menuCategoryId: String(g.menuCategoryId ?? g.menu_category_id ?? ""),
          menuCategoryName: String(
            g.menuCategoryName ?? g.menu_category_name ?? "",
          ),
          quantity: Number(g.quantity ?? 1),
        })),
        active: r.active !== false,
      }));
    } catch (error) {
      throw toApiError(error);
    }
  },

  async createCombo(input: {
    name: string;
    selling_price: number;
    selection_groups: Array<{
      menu_category_id: string;
      quantity: number;
    }>;
  }): Promise<void> {
    try {
      await apiClient.post(endpoints.menu.combos, input);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async previewCombo(input: {
    combo_id: string;
    quantity?: number;
    selections: Array<{ group_index: number; menu_item_ids: string[] }>;
  }) {
    try {
      const { data } = await apiClient.post(endpoints.menu.comboPreview, input);
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },
};
