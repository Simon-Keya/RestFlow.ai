import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { buildQueryString } from "@/lib/utils";
import type { DateRangeParams } from "@/types/common";
import type { ShopSummary, DashboardKpis, DashboardAlert } from "./types";

export const dashboardApi = {
  async getSummary(
    shopId: string,
    range?: DateRangeParams,
  ): Promise<ShopSummary> {
    try {
      const { data } = await apiClient.get<ShopSummary>(
        `${endpoints.dashboard.summary}${buildQueryString({
          shopId,
          from: range?.from,
          to: range?.to,
        })}`,
      );
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getKpis(shopId: string, range: DateRangeParams): Promise<DashboardKpis> {
    try {
      const { data } = await apiClient.get<DashboardKpis>(
        `${endpoints.dashboard.kpis}${buildQueryString({ shopId, ...range })}`,
      );
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getAlerts(shopId: string): Promise<DashboardAlert[]> {
    try {
      const { data } = await apiClient.get<DashboardAlert[]>(
        `/dashboard/alerts${buildQueryString({ shopId })}`,
      );
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },
};
