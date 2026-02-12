import { fetch } from "@tauri-apps/plugin-http";

const API_BASE_URL = import.meta.env.VITE_API_URL;
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
