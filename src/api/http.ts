import { fetch } from "@tauri-apps/plugin-http";

const DEFAULT_API_BASE_URL = "https://filearchitect.com/api/v1";
const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_BASE_URL;
/**
 * Generic API response type
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Makes a POST request to the API
 */
export async function makeApiRequest<T>(
  endpoint: string,
  payload: Record<string, any>
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const serverMessage =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`;
    const message = Object.entries(payload).reduce((text, [key, value]) => {
      if (!/key|token|password|secret/i.test(key) || typeof value !== "string" || !value) {
        return text;
      }
      return text.replaceAll(value, "[redacted]");
    }, serverMessage);
    throw new Error(message);
  }

  return (await response.json()) as T;
}
