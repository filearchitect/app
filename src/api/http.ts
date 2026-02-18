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
  console.log("payload", payload);

  try {
    if (!API_BASE_URL) {
      throw new Error("VITE_API_URL is not configured");
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log("Making API request to:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const json = await response.json();
    console.log("Response from API request:", json);
    return json;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}
