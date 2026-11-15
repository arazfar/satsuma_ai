import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from "expo-secure-store";
import { authStorage, subscribeAuthStorageErrors } from "./authStorage";

afterEach(() => vi.resetAllMocks());

describe("native session persistence", () => {
  it("reads and writes only through iOS SecureStore", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("saved-session");
    expect(await authStorage.getItem("session-key")).toBe("saved-session");
    await authStorage.setItem("session-key", "new-session");
    await authStorage.removeItem("session-key");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("session-key");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("session-key", "new-session");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("session-key");
  });

  it("does not replace an identity when secure reads fail", async () => {
    const failure = Object.assign(new Error("private native diagnostic"), { code: "E_SECURESTORE_READ_ERROR" });
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(failure);
    const notify = vi.fn();
    const unsubscribe = subscribeAuthStorageErrors(notify);
    await expect(authStorage.getItem("session-key")).rejects.toBe(failure);
    expect(notify).toHaveBeenCalledExactlyOnceWith("E_SECURESTORE_READ_ERROR");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("exposes only a safe error code, never a native message or stored value", async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error("private native diagnostic"));
    const notify = vi.fn();
    const unsubscribe = subscribeAuthStorageErrors(notify);
    await expect(authStorage.setItem("session-key", "private-token")).rejects.toThrow();
    expect(notify).toHaveBeenCalledExactlyOnceWith("SECURE_STORAGE_UNAVAILABLE");
    unsubscribe();
  });
});
