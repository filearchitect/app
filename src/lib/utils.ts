import { open } from "@tauri-apps/plugin-shell";
import { clsx, type ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

const DEFAULT_APP_URL = "https://filearchitect.com";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

export async function openLink(url: string) {
  try {
    await open(url);
  } catch (error) {
    console.log(error);

    toast.error("Failed to open link");
  }
}

export function getAppBaseUrl() {
  const configured = (import.meta.env.VITE_APP_URL || "").trim();
  if (!configured) {
    return DEFAULT_APP_URL;
  }
  return configured.replace(/\/+$/, "");
}

export function appUrl(path: string) {
  const base = getAppBaseUrl();
  if (!path) {
    return base;
  }
  return `${base}/${path.replace(/^\/+/, "")}`;
}
