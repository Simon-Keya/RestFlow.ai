import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import type { LoginInput } from "./schema";
import type { LoginResponse, User } from "./types";

export const authApi = {
  async login(input: LoginInput): Promise<LoginResponse> {
    try {
      const { data } = await apiClient.post<LoginResponse>(endpoints.auth.login, input);
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async me(): Promise<User> {
    try {
      const { data } = await apiClient.get<User>(endpoints.auth.me);
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },
};
