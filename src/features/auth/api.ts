const API_URL =
  import.meta.env.VITE_API_URL?.trim() || "https://filearchitect.com/api/v1";

export class AuthApi {
  private static async makeRequest<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok)
      throw new Error(`${response.status}: ${response.statusText}`);
    const json = await response.json();
    return json.data || json;
  }
}
