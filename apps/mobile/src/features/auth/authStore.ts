// apps/mobile/src/features/auth/authStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import apiClient from '../../api/apiClient';
import {
  disconnectAllSockets,
  refreshSocketAuth,
  setSocketTokenCache,
} from '../../lib/socket';
import { STORAGE_KEYS } from '../../lib/constants';

export type UserRole = 'MANAGER' | 'KITCHEN' | 'POS' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setHydrated: (value: boolean) => void;
  bootstrap: () => Promise<void>;
}

const TOKEN_KEY = STORAGE_KEYS.AUTH_TOKEN || 'restflow_auth_token';

async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function setAuthToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('SecureStore token write failed', err);
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      error: null,

      clearError: () => set({ error: null }),

      setHydrated: (value) => set({ isHydrated: value }),

      bootstrap: async () => {
        try {
          const secureToken = await getAuthToken();
          const current = get().token;

          if (secureToken && !current) {
            set({
              token: secureToken,
              isAuthenticated: !!get().user,
            });
            setSocketTokenCache(secureToken);
          } else if (current) {
            setSocketTokenCache(current);
          }

          if (secureToken || current) {
            await refreshSocketAuth();
          }
        } finally {
          set({ isHydrated: true });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.post('/auth/login', {
            email: email.trim().toLowerCase(),
            password,
          });

          const access_token: string =
            res.data?.access_token || res.data?.data?.access_token;
          const user: AuthUser = res.data?.user || res.data?.data?.user;

          if (!access_token || !user) {
            throw new Error('Invalid login response from server');
          }

          await setAuthToken(access_token);
          setSocketTokenCache(access_token);

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          await refreshSocketAuth();
        } catch (err: any) {
          const message =
            err?.response?.data?.message ||
            err?.message ||
            'Login failed. Check email and password.';

          set({
            isLoading: false,
            error: Array.isArray(message) ? message.join(', ') : message,
            isAuthenticated: false,
            token: null,
            user: null,
          });
          throw err;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.post('/auth/register', {
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            password: data.password,
            role: data.role || 'KITCHEN',
          });

          const access_token: string =
            res.data?.access_token || res.data?.data?.access_token;
          const user: AuthUser = res.data?.user || res.data?.data?.user;

          if (!access_token || !user) {
            throw new Error('Invalid register response from server');
          }

          await setAuthToken(access_token);
          setSocketTokenCache(access_token);

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          await refreshSocketAuth();
        } catch (err: any) {
          const message =
            err?.response?.data?.message ||
            err?.message ||
            'Registration failed';

          set({
            isLoading: false,
            error: Array.isArray(message) ? message.join(', ') : message,
            isAuthenticated: false,
            token: null,
            user: null,
          });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          try {
            await apiClient.post('/auth/logout');
          } catch {
            // offline / no endpoint
          }
        } finally {
          disconnectAllSockets();
          setSocketTokenCache(null);
          await setAuthToken(null);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },
    }),
    {
      name: 'restflow-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        if (state?.token) {
          setSocketTokenCache(state.token);
          void refreshSocketAuth();
        }
      },
    },
  ),
);