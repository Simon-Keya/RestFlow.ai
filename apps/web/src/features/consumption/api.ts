// apps/web/src/features/consumption/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { DateRangeParams } from "@/types/common";
import type {
  ConsumptionSummary,
  ConsumptionAlert,
  TopConsumedProduct,
  TopConsumedMenuItem,
} from "./types";

export const consumptionApi = {
  async getSummary(
    shopId: string,
    range: DateRangeParams,
  ): Promise<ConsumptionSummary> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.consumption.summary}${buildQueryString({
          shopId,
          ...range,
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        totalConsumedValue: Number(root.totalConsumedValue ?? 0),
        periodRevenue: Number(root.periodRevenue ?? 0),
        foodCostPercent:
          root.foodCostPercent == null ? null : Number(root.foodCostPercent),
        topProducts: asArray<TopConsumedProduct>(
          root.topProducts ?? data,
        ),
        topMenuItems: asArray<TopConsumedMenuItem>(
          root.topMenuItems ?? [],
        ),
        method: (root.method as string) ?? "recipe_x_usage",
      } as ConsumptionSummary;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getProductDetail(
    productId: string,
    range: DateRangeParams,
  ): Promise<
    TopConsumedProduct & {
      history: { date: string; quantity: number }[];
      availableStock?: number;
    }
  > {
    try {
      const { data } = await apiClient.get(
        `${endpoints.consumption.byProduct(productId)}${buildQueryString({
          ...range,
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        itemId: String(root.itemId ?? productId),
        name: String(root.name ?? productId),
        unit: String(root.unit ?? "pcs"),
        quantityConsumed: Number(root.quantityConsumed ?? 0),
        valueConsumed: Number(root.valueConsumed ?? 0),
        availableStock: Number(root.availableStock ?? 0),
        history: asArray<{ date: string; quantity: number }>(root.history),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getMenuItemDetail(
    menuItemId: string,
    range: DateRangeParams,
  ): Promise<
    TopConsumedMenuItem & { history: { date: string; unitsSold: number }[] }
  > {
    try {
      const { data } = await apiClient.get(
        `${endpoints.consumption.byMenuItem(menuItemId)}${buildQueryString({
          ...range,
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        menuItemId: String(root.menuItemId ?? menuItemId),
        name: String(root.name ?? menuItemId),
        unitsSold: Number(root.unitsSold ?? 0),
        revenue: Number(root.revenue ?? 0),
        foodCostPercent:
          root.foodCostPercent == null ? null : Number(root.foodCostPercent),
        history: asArray<{ date: string; unitsSold: number }>(root.history),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getAlerts(shopId: string): Promise<ConsumptionAlert[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.consumption.alerts}${buildQueryString({ shopId })}`,
      );
      return asArray<ConsumptionAlert>(data);
    } catch (error) {
      throw toApiError(error);
    }
  },
};