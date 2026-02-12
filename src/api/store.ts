import { decrypt, encrypt } from "@/utils/encryption";
import { Store } from "@tauri-apps/plugin-store";

export const STORE_PATH =
  import.meta.env.VITE_APP_ENV === "production"
    ? "fa.production.json"
    : "fa.local.json";

let storeInstance: Store | null = null;

export const getStore = async () => {
  if (!storeInstance) {
    storeInstance = await Store.load(STORE_PATH);
  }
  return storeInstance;
};

// Utility function to clear the store and reinitialize it
export const clearStore = async (): Promise<void> => {
  const store = await getStore();
  await store.clear();
  await store.save();

  // Re-initialize store with default values
  storeInstance = await Store.load(STORE_PATH);
};

export const getStoreValue = async <T>(key: string): Promise<T | null> => {
  const store = await getStore();
  const value = await store.get<string | T>(key);

  if (value === undefined) {
    return null;
  }

  // Special handling for machine info which is set by Rust
  if (key === "machine" && typeof value === "object") {
    return value as T;
  }

  // If the value is not a string, return it as is
  if (typeof value !== "string") {
    return value as T;
  }

  try {
    // Try to decrypt the value first
    const decryptedValue = await decrypt(value);
    return JSON.parse(decryptedValue) as T;
  } catch (error) {
    // If decryption fails, return the original value
    // This handles cases where the value wasn't encrypted in the first place
    return value as T;
  }
};

export const setStoreValue = async <T>(
  key: string,
  value: T
): Promise<void> => {
  const store = await getStore();

  // Don't encrypt machine info as it's managed by Rust
  if (key === "machine") {
    await store.set(key, value);
  } else {
    const stringValue = JSON.stringify(value);
    const encryptedValue = await encrypt(stringValue);
    await store.set(key, encryptedValue);
  }

  await store.save();
};

// Function to check if store needs initialization
export const initializeStore = async (): Promise<void> => {
  const store = await getStore();
  const machine = await getStoreValue("machine");

  if (!machine) {
    // Reload the store to get the machine info from Rust
    storeInstance = null;
    await getStore();
  }
};
