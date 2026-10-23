import type { AxiosInstance } from "axios";
import { readAuthTokenClient, clearAuthToken } from "@/lib/auth/token";
import { routes } from "@/lib/routes";

/**
 * Attaches the bearer token to every request and handles the one cross-cutting response
 * concern that has to live here: a 401 means the session is gone (expired/revoked/logged out
 * elsewhere), so we clear local state and bounce to login rather than let every single hook
 * that calls the API reimplement that check.
 */
export function attachInterceptors(client: AxiosInstance) {
  client.interceptors.request.use((config) => {
    const token = readAuthTokenClient();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401 && typeof window !== "undefined") {
        clearAuthToken();
        const next = encodeURIComponent(window.location.pathname);
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = `${routes.login()}?next=${next}`;
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}
