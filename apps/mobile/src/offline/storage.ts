// apps/mobile/src/offline/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const STORAGE_PREFIX = '@restflow:';

export const setItem = async (key: string, value: any): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(STORAGE_PREFIX + key, jsonValue);
  } catch (e) {
    console.error('Storage set error:', e);
  }
};

export const getItem = async <T>(key: string): Promise<T | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Storage get error:', e);
    return null;
  }
};

export const removeItem = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {
    console.error('Storage remove error:', e);
  }
};

// Secure storage (for tokens, sensitive data)
export const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.error('Secure store set error:', e);
  }
};

export const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.error('Secure store get error:', e);
    return null;
  }
};