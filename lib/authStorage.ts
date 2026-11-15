import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const errorListeners = new Set<(code: string) => void>();

export function subscribeAuthStorageErrors(listener: (code: string) => void) {
  errorListeners.add(listener);
  return () => { errorListeners.delete(listener); };
}

async function secureOperation<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z_0-9]+$/.test(error.code) ? error.code : "SECURE_STORAGE_UNAVAILABLE";
    for (const listener of errorListeners) listener(code);
    throw error;
  }
}

export const authStorage = {
  getItem: (key: string) => Platform.OS === "web"
    ? (typeof localStorage === "undefined" ? null : localStorage.getItem(key))
    : secureOperation(() => SecureStore.getItemAsync(key)),
  setItem: (key: string, value: string) => Platform.OS === "web"
    ? localStorage.setItem(key, value)
    : secureOperation(() => SecureStore.setItemAsync(key, value)),
  removeItem: (key: string) => Platform.OS === "web"
    ? localStorage.removeItem(key)
    : secureOperation(() => SecureStore.deleteItemAsync(key)),
};
