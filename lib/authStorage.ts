import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const authStorage = {
  getItem: (key: string) => Platform.OS === "web"
    ? (typeof localStorage === "undefined" ? null : localStorage.getItem(key))
    : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => Platform.OS === "web"
    ? localStorage.setItem(key, value)
    : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => Platform.OS === "web"
    ? localStorage.removeItem(key)
    : SecureStore.deleteItemAsync(key),
};
