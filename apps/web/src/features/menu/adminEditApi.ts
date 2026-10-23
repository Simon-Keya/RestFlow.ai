import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";

function catalogItemPath(menuItemId: string) {
  return `/menu/catalog-items/${encodeURIComponent(menuItemId)}`;
}

function comboPath(comboId: string) {
  return `/menu/combos/${encodeURIComponent(comboId)}`;
}

function adjustMenuPath(menuId: string) {
  return `/menu/${encodeURIComponent(menuId)}/adjust`;
}

export type CatalogItemUpdateBody = {
  name?: string;
  selling_price?: number;
  active?: boolean;
  recipe_id?: string | null;
  stock_item_id?: string | null;
  production_type?: "recipe" | "stocked";
};

export type ComboUpdateBody = {
  name?: string;
  selling_price?: number;
  active?: boolean;
};

/** Full adjust body — parity with CreateMenu domain fields */
export type AdjustMenuBody = {
  name?: string;
  menu_code?: string | null;
  category?: string | null;
  selling_price?: number;
  tax_rate?: number;
  active?: boolean;
  is_available?: boolean;
  is_visible?: boolean;
  notes?: string | null;
  preparation_time_minutes?: number | null;
  image_url?: string | null;
  lines?: Array<{
    component_key: string;
    component_type: string;
    finished_good_id?: string;
    finished_good_name?: string;
    finished_good_category_id?: string;
    option_item_ids?: string[];
    quantity_required: number;
    unit: string;
    min_select?: number;
    max_select?: number;
    allow_repeat?: boolean;
  }>;
  expected_updated_at?: string | null;
};

export const adminEditApi = {
  async updateCatalogItem(
    menuItemId: string,
    body: CatalogItemUpdateBody,
  ): Promise<{
    success: boolean;
    menuItemId: string;
    name: string;
    sellingPrice: number;
    active: boolean;
  }> {
    try {
      const { data } = await apiClient.patch(catalogItemPath(menuItemId), body);
      return data as {
        success: boolean;
        menuItemId: string;
        name: string;
        sellingPrice: number;
        active: boolean;
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async adjustMenu(
    menuId: string,
    body: AdjustMenuBody,
  ): Promise<{
    success: boolean;
    menuId: string;
    name: string;
    sellingPrice: number;
    nameClashWarning?: string | null;
  }> {
    try {
      const payload = {
        name: body.name,
        menu_code: body.menu_code,
        category: body.category,
        selling_price: body.selling_price,
        tax_rate: body.tax_rate,
        is_available: body.is_available ?? body.active,
        is_visible: body.is_visible ?? body.active,
        notes: body.notes,
        preparation_time_minutes: body.preparation_time_minutes,
        image_url: body.image_url,
        lines: body.lines,
        expected_updated_at: body.expected_updated_at,
      };
      const { data } = await apiClient.patch(adjustMenuPath(menuId), payload);
      return data as {
        success: boolean;
        menuId: string;
        name: string;
        sellingPrice: number;
        nameClashWarning?: string | null;
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async updateCombo(
    comboId: string,
    body: ComboUpdateBody,
  ): Promise<{
    success: boolean;
    comboId: string;
    name: string;
    sellingPrice: number;
    active: boolean;
  }> {
    try {
      const { data } = await apiClient.patch(comboPath(comboId), body);
      return data as {
        success: boolean;
        comboId: string;
        name: string;
        sellingPrice: number;
        active: boolean;
      };
    } catch (error) {
      throw toApiError(error);
    }
  },
};
