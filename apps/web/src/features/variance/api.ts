// apps/web/src/features/variance/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { Paginated } from "@/types/common";
import type { VarianceBatch, VarianceLine } from "./types";
import type { ReasonCodeInput } from "./schema";

export const varianceApi = {
  async getBatches(
    shopId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<VarianceBatch>> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.variance.batches}${buildQueryString({
          shopId,
          page,
          pageSize,
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const items = asArray<VarianceBatch>(data);
      return {
        items,
        total: Number(root.total ?? items.length),
        page: Number(root.page ?? page),
        pageSize: Number(root.pageSize ?? pageSize),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getBatch(
    batchId: string,
  ): Promise<VarianceBatch & { lines: VarianceLine[] }> {
    try {
      const { data } = await apiClient.get(endpoints.variance.batch(batchId));
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        ...(root as unknown as VarianceBatch),
        lines: asArray<VarianceLine>(root.lines ?? data),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async flagBatch(
    batchId: string,
    flagged: boolean,
    note?: string,
  ): Promise<void> {
    try {
      await apiClient.post(endpoints.variance.flag(batchId), {
        flagged,
        note,
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async submitReasonCode(
    batchId: string,
    input: ReasonCodeInput,
  ): Promise<void> {
    try {
      await apiClient.post(
        endpoints.variance.submitReasonCode(batchId),
        input,
      );
    } catch (error) {
      throw toApiError(error);
    }
  },
};
