import { fetch } from "@tauri-apps/plugin-http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeApiRequest } from "../http";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

describe("license API requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not log credentials or server responses", async () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ license_key: "FA-SECRET" }),
    } as Response);

    await expect(
      makeApiRequest("/licenses/validation", { license_key: "FA-SECRET" })
    ).resolves.toEqual({ license_key: "FA-SECRET" });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("redacts a submitted key in server errors", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "License FA-SECRET is invalid" }),
    } as Response);

    await expect(
      makeApiRequest("/licenses/validation", { license_key: "FA-SECRET" })
    ).rejects.toThrow("License [redacted] is invalid");
  });
});
