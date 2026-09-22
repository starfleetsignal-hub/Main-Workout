import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secrets (broker API keys, the license key) go in the OS keychain/keystore
 * via expo-secure-store on iOS/Android. SecureStore is not available on web,
 * where we fall back to AsyncStorage (localStorage) so the web build still works.
 *
 * Note: SecureStore values are limited to 2048 bytes; everything we store is far smaller.
 */
const useSecure = Platform.OS !== 'web';

export async function secureGet(key: string): Promise<string | null> {
  try {
    if (useSecure) return await SecureStore.getItemAsync(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (useSecure) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    if (useSecure) await SecureStore.deleteItemAsync(key);
    else await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Non-secret preferences (parameters, watchlist) live in plain AsyncStorage. */
export async function prefGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function prefSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
