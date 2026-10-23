// apps/mobile/src/api/apiClient.ts
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../lib/constants';
import { getAuthToken, setAuthToken } from '../lib/tokenStorage';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // 1) Fast path: token already in Zustand (set right after login)
      let token: string | null = null;
      try {
        const { useAuthStore } = require('../features/auth/authStore') as {
          useAuthStore: { getState: () => { token: string | null } };
        };
        token = useAuthStore.getState().token;
      } catch {
        // store not ready
      }

      // 2) Fallback: SecureStore (app restart / cold start)
      if (!token) {
        token = await getAuthToken();
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (__DEV__) {
        console.warn(
          '[apiClient] No auth token for',
          config.method?.toUpperCase(),
          config.url,
        );
      }
    } catch (err) {
      console.warn('Failed to attach auth token', err);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string | string[] }>) => {
    const status = error.response?.status;
    const raw =
      error.response?.data?.message || error.message || 'Network error';
    const message = Array.isArray(raw) ? raw.join(', ') : raw;

    console.error('API Error:', message, {
      url: error.config?.url,
      status,
      hadAuthHeader: !!error.config?.headers?.Authorization,
    });

    // Only force-logout when the server rejected a request that *did* send a token
    if (status === 401 && error.config?.headers?.Authorization) {
      await setAuthToken(null);

      try {
        const { disconnectAllSockets } = require('../lib/socket') as {
          disconnectAllSockets: () => void;
        };
        disconnectAllSockets();
      } catch {
        // ignore
      }

      try {
        const { useAuthStore } = require('../features/auth/authStore') as {
          useAuthStore: {
            setState: (partial: Record<string, unknown>) => void;
          };
        };
        useAuthStore.setState({
          user: null,
          token: null,
          isAuthenticated: false,
          error: 'Session expired. Please log in again.',
        });
      } catch {
        // ignore
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;