// apps/web/src/features/kitchen/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type {
  ActiveOrder,
  ClosingStockEntry,
  ProductionHistoryItem,
  ProductionQueueItem,
  Recipe,
  RecipeIngredient,
} from "./types";
import type { StartProductionInput, ClosingStockSubmission, PrePrepInput } from "./schema";

function toKitchenIngredient(raw: Record<string, unknown>): RecipeIngredient {
  return {
    rawItemId: String(raw.rawItemId ?? raw.raw_item_id ?? ""),
    name: String(raw.name ?? raw.rawItemName ?? raw.raw_item_name ?? ""),
    quantityPerUnit: Number(
      raw.quantityPerUnit ?? raw.quantity_per_unit ?? 0,
    ),
    unit: String(raw.unit ?? "pcs"),
    unitCost: Number(raw.unitCost ?? raw.unit_cost ?? 0),
  };
}

function toKitchenRecipe(raw: Record<string, unknown>): Recipe {
  const ingredients = asArray<Record<string, unknown>>(raw.ingredients).map(
    toKitchenIngredient,
  );

  const standardYield = Number(
    raw.standardYield ?? raw.standard_yield ?? raw.yieldQuantity ?? 1,
  );
  const unit = String(raw.unit ?? raw.yieldUnit ?? "portion");

  const maxPortionsFromStock = Number(
    raw.maxPortionsFromStock ?? raw.max_portions ?? 0,
  );

  let isAvailable: boolean;
  if (typeof raw.isAvailable === "boolean") {
    isAvailable = raw.isAvailable;
  } else if (typeof raw.is_available === "boolean") {
    isAvailable = raw.is_available;
  } else {
    isAvailable = maxPortionsFromStock > 0;
  }

  const outputs = asArray<Record<string, unknown>>(raw.outputs).map((o) => ({
    itemId: String(o.itemId ?? o.item_id ?? ""),
    itemName: String(o.itemName ?? o.item_name ?? o.item_id ?? ""),
    standardQuantity:
      o.standardQuantity != null || o.standard_quantity != null
        ? Number(o.standardQuantity ?? o.standard_quantity)
        : null,
    unit: String(o.unit ?? unit),
    unitWeight:
      o.unitWeight != null || o.unit_weight != null
        ? Number(o.unitWeight ?? o.unit_weight)
        : null,
    weightUnit:
      o.weightUnit != null || o.weight_unit != null
        ? String(o.weightUnit ?? o.weight_unit)
        : "g",
    isDefault: Boolean(o.isDefault ?? o.is_default ?? false),
  }));

  return {
    recipeId: String(raw.recipeId ?? raw.recipe_id ?? raw.id ?? ""),
    name: String(raw.name ?? raw.item_name ?? raw.itemName ?? ""),
    menuItemId: String(raw.itemId ?? raw.item_id ?? raw.menuItemId ?? ""),
    yieldQuantity: standardYield,
    yieldUnit: unit,
    ingredients,
    isAvailable,
    maxPortionsFromStock,
    outputs: outputs.length > 0 ? outputs : undefined,
  };
}

function mapQueueItem(raw: Record<string, unknown>): ProductionQueueItem {
  return {
    productionId: String(raw.productionId ?? raw.production_id ?? ""),
    recipeId: String(raw.recipeId ?? raw.recipe_id ?? ""),
    recipeName: String(raw.recipeName ?? raw.recipe_name ?? ""),
    batchSize: Number(raw.batchSize ?? raw.batch_size ?? 0),
    status: (raw.status === "finished" ? "finished" : "started") as
      | "started"
      | "finished",
    startedAt: String(raw.startedAt ?? raw.started_at ?? ""),
    finishedAt: (raw.finishedAt ?? raw.finished_at ?? null) as string | null,
  };
}

function mapHistoryItem(raw: Record<string, unknown>): ProductionHistoryItem {
  return {
    productionId: String(raw.productionId ?? raw.production_id ?? ""),
    recipeId: String(raw.recipeId ?? raw.recipe_id ?? ""),
    recipeName: String(raw.recipeName ?? raw.recipe_name ?? ""),
    itemId: String(raw.itemId ?? raw.item_id ?? ""),
    batchSize: Number(raw.batchSize ?? raw.batch_size ?? 0),
    actualYield:
      raw.actualYield != null || raw.actual_yield != null
        ? Number(raw.actualYield ?? raw.actual_yield)
        : null,
    batchNumber: (raw.batchNumber ?? raw.batch_number ?? null) as string | null,
    expiryDate: (raw.expiryDate ?? raw.expiry_date ?? null) as string | null,
    stockExpiry: (raw.stockExpiry ?? null) as string | null,
    availableStock:
      raw.availableStock != null || raw.available_stock != null
        ? Number(raw.availableStock ?? raw.available_stock)
        : null,
    totalValue:
      raw.totalValue != null || raw.total_value != null
        ? Number(raw.totalValue ?? raw.total_value)
        : null,
    unit: String(raw.unit ?? "pcs"),
    status: "finished",
    startedAt: String(raw.startedAt ?? raw.started_at ?? ""),
    finishedAt: (raw.finishedAt ?? raw.finished_at ?? null) as string | null,
  };
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    message?: string;
  };
  if (e.code === "ECONNABORTED") return true;
  if (/timeout/i.test(String(e.message ?? ""))) return true;
  return false;
}

function mapActiveOrder(raw: Record<string, unknown>): ActiveOrder {
  const items = asArray<Record<string, unknown>>(raw.items ?? raw.lines).map(
    (it) => {
      const selectionsRaw = asArray<Record<string, unknown>>(
        it.selections ?? it.combo_selections ?? it.resolved_menu_items,
      );
      const selections = selectionsRaw
        .map((s) => {
          // Already expanded selection shape
          if (s.menu_item_name || s.menuItemName || s.name) {
            return {
              groupIndex: Number(s.group_index ?? s.groupIndex ?? 0),
              groupName:
                (s.group_name as string | undefined) ??
                (s.groupName as string | undefined) ??
                (s.menu_category_name as string | undefined),
              menuItemId: String(
                s.menu_item_id ?? s.menuItemId ?? s.id ?? "",
              ),
              menuItemName: String(
                s.menu_item_name ?? s.menuItemName ?? s.name ?? "",
              ),
              quantity: Number(s.quantity ?? s.qty ?? 1),
            };
          }
          // combo_selections group with parallel ids/names
          const ids = asArray<string>(s.menu_item_ids ?? s.menuItemIds);
          const names = asArray<string>(s.menu_item_names ?? s.menuItemNames);
          return ids.map((id, i) => ({
            groupIndex: Number(s.group_index ?? s.groupIndex ?? 0),
            groupName:
              (s.group_name as string | undefined) ??
              (s.groupName as string | undefined),
            menuItemId: id,
            menuItemName: names[i] ?? id,
            quantity: 1,
          }));
        })
        .flat()
        .filter((s) => s.menuItemId || s.menuItemName);

      return {
        menuItemId: String(it.menu_id ?? it.menuItemId ?? it.combo_id ?? ""),
        name: String(it.menu_name ?? it.name ?? it.item_name ?? ""),
        quantity: Number(it.quantity ?? it.qty ?? 0),
        notes:
          it.notes != null && String(it.notes).trim()
            ? String(it.notes)
            : undefined,
        lineType: (it.line_type ?? it.lineType) as string | undefined,
        comboId: (it.combo_id ?? it.comboId) as string | undefined,
        selections: selections.length > 0 ? selections : undefined,
      };
    },
  );

  const statusRaw = String(raw.status ?? "pending").toLowerCase();
  let status: ActiveOrder["status"];
  if (
    statusRaw === "pending" ||
    statusRaw === "preparing" ||
    statusRaw === "ready" ||
    statusRaw === "served" ||
    statusRaw === "cancelled"
  ) {
    status = statusRaw;
  } else if (statusRaw === "completed") {
    status = "served";
  } else {
    status = "pending";
  }

  const orderTypeRaw = String(raw.orderType ?? raw.order_type ?? "dine_in")
    .toLowerCase()
    .replace(/-/g, "_");

  return {
    orderId: String(raw.orderId ?? raw.order_id ?? ""),
    status,
    orderType: orderTypeRaw as ActiveOrder["orderType"],
    tableNumber: (raw.tableNumber ?? raw.table_number ?? null) as
      | string
      | null,
    items,
    totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
    createdAt: String(
      raw.createdAt ??
        raw.timestamp ??
        raw.created_at ??
        new Date().toISOString(),
    ),
    updatedAt: String(
      raw.updatedAt ??
        raw.last_updated_at ??
        raw.createdAt ??
        raw.timestamp ??
        new Date().toISOString(),
    ),
  };
}

export const kitchenApi = {
  async getActiveOrders(shopId: string): Promise<ActiveOrder[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.kitchen.activeOrders}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.orders ?? root.items ?? root.data ?? data,
      );
      return rows.map(mapActiveOrder).filter((o) => o.orderId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getProductionQueue(shopId: string): Promise<ProductionQueueItem[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.kitchen.productionQueue}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.queue ?? root.items ?? root.data ?? data,
      );
      return rows.map(mapQueueItem).filter((r) => r.productionId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getProductionHistory(shopId: string): Promise<ProductionHistoryItem[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.kitchen.productionHistory}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.history ?? root.data ?? data,
      );
      return rows.map(mapHistoryItem).filter((r) => r.productionId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getRecipes(shopId: string): Promise<Recipe[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.recipe.list}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(root.items ?? data);
      return rows.map(toKitchenRecipe).filter((r) => r.recipeId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getRecipe(recipeId: string, shopId?: string): Promise<Recipe> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.recipe.detail(recipeId)}${buildQueryString(
          shopId ? { shopId } : {},
        )}`,
      );
      return toKitchenRecipe((data ?? {}) as Record<string, unknown>);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async startProduction(input: StartProductionInput): Promise<void> {
    try {
      const shopId =
        (input as { shop_id?: string; shopId?: string }).shop_id ??
        (input as { shopId?: string }).shopId;

      const recipe = await this.getRecipe(input.recipe_id, shopId);
      const itemId = recipe.menuItemId;
      const itemName = recipe.name;

      if (!itemId) {
        throw new Error(
          "Recipe has no finished item SKU. Edit the recipe and set Finished item ID.",
        );
      }

      await apiClient.post(endpoints.production.start, {
        recipe_id: input.recipe_id,
        item_id: itemId,
        item_name: itemName || itemId,
        planned_quantity: input.batch_size,
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async finishProduction(
    productionId: string,
    actualYield: number,
    options?: {
      shopId?: string;
      itemId?: string;
      itemName?: string;
      plannedQuantity?: number;
      unitCost?: number;
      wasteQuantity?: number;
      wasteReason?: string;
      batchNumber?: string;
      expiryDate?: string;
      inputs?: Array<{
        itemId: string;
        itemName?: string;
        actualQuantity: number;
        unit?: string;
        standardQuantity?: number;
        unitCost?: number;
      }>;
      outputs?: Array<{
        itemId: string;
        itemName?: string;
        actualQuantity: number;
        unit?: string;
        standardQuantity?: number;
        unitCost?: number;
        unitWeight?: number;
        weightUnit?: string;
      }>;
    },
  ): Promise<void> {
    const shopId = options?.shopId ?? "1";

    const body = {
      production_id: productionId,
      item_id: options?.itemId,
      item_name: options?.itemName,
      planned_quantity: options?.plannedQuantity,
      actual_quantity_produced: actualYield,
      batch_number: options?.batchNumber?.trim()
        ? options.batchNumber.trim()
        : `AUTO-${productionId.slice(-8)}`,
      // Never invent shelf life — modal must collect expiry (Michael 4 Oct 2026)
      expiry_date: options?.expiryDate?.trim()
        ? options.expiryDate.trim()
        : (() => {
            throw new Error(
              "Expiry date is required when finishing production.",
            );
          })(),
      unit_cost: options?.unitCost ?? 0,
      waste_quantity: options?.wasteQuantity ?? 0,
      waste_reason: options?.wasteReason,
      inputs: options?.inputs?.map((l) => ({
        item_id: l.itemId,
        item_name: l.itemName,
        actual_quantity: l.actualQuantity,
        unit: l.unit,
        standard_quantity: l.standardQuantity,
        unit_cost: l.unitCost,
      })),
      outputs: options?.outputs?.map((l) => ({
        item_id: l.itemId,
        item_name: l.itemName,
        actual_quantity: l.actualQuantity,
        unit: l.unit,
        standard_quantity: l.standardQuantity,
        unit_cost: l.unitCost,
        unit_weight: l.unitWeight,
        weight_unit: l.weightUnit,
      })),
    };

    try {
      await apiClient.post(endpoints.production.finish, body, {
        timeout: 60_000,
      });
      return;
    } catch (error: unknown) {
      if (isTimeoutError(error)) {
        const completed = await this.isProductionAlreadyFinished(
          productionId,
          shopId,
        );
        if (completed) {
          return;
        }
      }
      throw toApiError(error);
    }
  },

  async isProductionAlreadyFinished(
    productionId: string,
    shopId: string,
  ): Promise<boolean> {
    try {
      const [queue, history] = await Promise.all([
        this.getProductionQueue(shopId),
        this.getProductionHistory(shopId),
      ]);

      const stillOpen = queue.some(
        (q) =>
          q.productionId === productionId && q.status === "started",
      );
      if (stillOpen) return false;

      return history.some((h) => h.productionId === productionId);
    } catch {
      return false;
    }
  },

  async getClosingStock(shopId: string): Promise<ClosingStockEntry[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.kitchen.closingStock}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.data ?? data,
      );
      return rows.map((raw) => ({
        itemId: String(raw.itemId ?? raw.item_id ?? ""),
        name: String(raw.name ?? raw.itemName ?? raw.item_name ?? ""),
        unit: String(raw.unit ?? "pcs"),
        expectedQuantity: Number(
          raw.expectedQuantity ?? raw.system_qty ?? raw.systemQty ?? 0,
        ),
        countedQuantity:
          raw.countedQuantity != null
            ? Number(raw.countedQuantity)
            : raw.counted_qty != null
              ? Number(raw.counted_qty)
              : raw.countedQty != null
                ? Number(raw.countedQty)
                : null,
      }));
    } catch (error) {
      throw toApiError(error);
    }
  },

  async submitClosingStock(
    shopId: string,
    submission: ClosingStockSubmission,
  ): Promise<void> {
    try {
      // Closing stock can update many inventory rows — allow up to 2 minutes
      await apiClient.post(
        endpoints.kitchen.submitClosingStock,
        {
          shop_id: shopId,
          shift_label: submission.shiftLabel,
          notes: submission.notes,
          lines: submission.entries.map((e) => ({
            item_id: e.itemId,
            counted_qty: e.countedQuantity,
          })),
        },
        { timeout: 120_000 },
      );
    } catch (error) {
      throw toApiError(error);
    }
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await apiClient.post(endpoints.kitchen.updateOrderStatus(orderId), {
        status,
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getPendingRefills(shopId: string) {
    try {
      const { data } = await apiClient.get(
        `${endpoints.refill.pending}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.data ?? data,
      );
      return rows
        .map((raw) => ({
          requestId: String(raw.requestId ?? raw.request_id ?? ""),
          itemId: String(raw.itemId ?? raw.item_id ?? ""),
          itemName: String(raw.itemName ?? raw.item_name ?? ""),
          quantity: Number(raw.quantity ?? raw.requested_qty ?? 0),
          unit: String(raw.unit ?? "pcs"),
          status: String(raw.status ?? "pending"),
          source: String(raw.source ?? "request"),
          requestedBy: String(raw.requestedBy ?? raw.requested_by ?? "staff"),
          requestedAt: String(
            raw.requestedAt ?? raw.created_at ?? raw.createdAt ?? "",
          ),
        }))
        .filter((r) => r.requestId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async issueRefill(
    requestId: string,
    options?: {
      approvedQty?: number;
      issuedQty?: number;
      unitCost?: number;
      batchNumber?: string;
      expiryDate?: string;
      notes?: string;
      shopId?: string;
    },
  ): Promise<void> {
    try {
      const approved =
        options?.approvedQty != null && options.approvedQty > 0
          ? options.approvedQty
          : options?.issuedQty != null && options.issuedQty > 0
            ? options.issuedQty
            : undefined;
      const issued =
        options?.issuedQty != null && options.issuedQty > 0
          ? options.issuedQty
          : approved;

      await apiClient.post(endpoints.refill.issue, {
        request_id: requestId,
        shop_id: options?.shopId ?? "1",
        ...(approved != null ? { approved_qty: approved } : {}),
        ...(issued != null ? { issued_qty: issued } : {}),
        ...(options?.unitCost != null ? { unit_cost: options.unitCost } : {}),
        ...(options?.batchNumber
          ? { batch_number: options.batchNumber }
          : {}),
        ...(options?.expiryDate ? { expiry_date: options.expiryDate } : {}),
        ...(options?.notes ? { notes: options.notes } : {}),
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getRefillDetail(requestId: string, shopId: string) {
    try {
      const { data } = await apiClient.get(
        `${endpoints.refill.detail(requestId)}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        requestId: String(root.requestId ?? requestId),
        status: String(root.status ?? "pending"),
        source: String(root.source ?? "request"),
        itemId: (root.itemId as string | null) ?? null,
        itemName: String(root.itemName ?? ""),
        unit: String(root.unit ?? "pcs"),
        requestedQty:
          root.requestedQty == null ? null : Number(root.requestedQty),
        issuedQty: root.issuedQty == null ? null : Number(root.issuedQty),
        batchNumber: (root.batchNumber as string | null) ?? null,
        expiryDate: (root.expiryDate as string | null) ?? null,
        availableStock:
          root.availableStock == null ? null : Number(root.availableStock),
        totalValue: Number(root.totalValue ?? 0),
        unitCost: Number(root.unitCost ?? 0),
        nextExpiryDate: (root.nextExpiryDate as string | null) ?? null,
        daysToExpiryMin:
          root.daysToExpiryMin == null ? null : Number(root.daysToExpiryMin),
        timeline: asArray<Record<string, unknown>>(root.timeline).map((ev) => ({
          type: String(ev.type ?? ""),
          at: String(ev.at ?? ""),
          actorUserId: (ev.actorUserId as string | null) ?? null,
          quantity: ev.quantity == null ? null : Number(ev.quantity),
          batchNumber: (ev.batchNumber as string | null) ?? null,
          expiryDate: (ev.expiryDate as string | null) ?? null,
          notes: (ev.notes as string | null) ?? null,
        })),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },
  async submitPrePrep(shopId: string, input: PrePrepInput): Promise<{
    batchId: string;
    original_qty: number;
    yielded_qty: number;
    lost_qty: number;
    loss_pct: number;
    prepped_unit_cost: number;
  }> {
    try {
      const { data } = await apiClient.post(endpoints.kitchen.prePrep ?? endpoints.production.prePrep, {
        shop_id: shopId,
        raw_item_id: input.raw_item_id,
        prepped_item_id: input.prepped_item_id,
        prepped_item_name: input.prepped_item_name,
        original_qty: input.original_qty,
        yielded_qty: input.yielded_qty,
        loss_reason: input.loss_reason,
        note: input.note,
        unit: input.unit ?? "kg",
        method: input.method,
      });
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        batchId: String(root.batchId ?? root.batch_id ?? ""),
        original_qty: Number(root.original_qty ?? input.original_qty),
        yielded_qty: Number(root.yielded_qty ?? input.yielded_qty),
        lost_qty: Number(root.lost_qty ?? 0),
        loss_pct: Number(root.loss_pct ?? 0),
        prepped_unit_cost: Number(root.prepped_unit_cost ?? 0),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

};