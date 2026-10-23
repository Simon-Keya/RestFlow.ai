// apps/mobile/src/api/posApiClient.ts
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { POS_API_BASE_URL } from '../lib/constants';
import { getAuthToken } from '../lib/tokenStorage';

/**
 * POS traffic may point at Go while the rest of the app uses Nest.
 * Same JWT; same shop claim.
 */
const posApiClient = axios.create({
  baseURL: POS_API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

posApiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token: string | null = null;
  try {
    const { useAuthStore } = require('../features/auth/authStore') as {
      useAuthStore: { getState: () => { token: string | null } };
    };
    token = useAuthStore.getState().token;
  } catch {
    /* ignore */
  }
  if (!token) token = await getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default posApiClient;
