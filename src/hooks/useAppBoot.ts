import { initializeStore } from "@/api/store";
import { runMigrations } from "@/migrations";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

// Global initialization promise
let initializationPromise: Promise<void> | null = null;

// Initialize the app once, outside of React's lifecycle
async function initializeApp() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const version = await getVersion();
      await runMigrations(version);
      await initializeStore();
    } catch (error) {
      console.error("Boot sequence error:", error);
      // Even if initialization fails, we don't want to try again
    }
  })();

  return initializationPromise;
}

export function useAppBoot() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp()
      .then(() => setIsInitialized(true))
      .catch(() => setIsInitialized(true)); // Show UI even on error
  }, []);

  return isInitialized;
}
