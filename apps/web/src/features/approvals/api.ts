import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { PendingApproval } from "./types";

export const approvalsApi = {
  async getPending(shopId: string): Promise<PendingApproval[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.approvals.pending}${buildQueryString({ shopId })}`,
      );
      return asArray<PendingApproval>(data);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async approve(approvalId: string, note?: string): Promise<void> {
    try {
      await apiClient.post(endpoints.approvals.approve(approvalId), { note });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async reject(approvalId: string, reason: string): Promise<void> {
    try {
      await apiClient.post(endpoints.approvals.reject(approvalId), { reason });
    } catch (error) {
      throw toApiError(error);
    }
  },
};