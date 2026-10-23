import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { TeamRole, TeamUser } from "./types";

export const teamApi = {
  async list(shopId: string): Promise<TeamUser[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.users.list}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<TeamUser>(root.items ?? data);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async changeRole(
    userId: string,
    role: TeamRole,
  ): Promise<{ message: string; oldRole: string; newRole: string }> {
    try {
      const { data } = await apiClient.patch(
        endpoints.users.changeRole(userId),
        { role },
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        message: String(root.message ?? "Role updated"),
        oldRole: String(root.oldRole ?? ""),
        newRole: String(root.newRole ?? role),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },
};
