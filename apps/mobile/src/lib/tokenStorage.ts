// apps/mobile/src/lib/tokenStorage.ts
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from './constants';

const TOKEN_KEY = STORAGE_KEYS.AUTH_TOKEN || 'restflow_auth_token';

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('tokenStorage write failed', err);
  }
}