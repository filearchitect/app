import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { arch } from "@tauri-apps/plugin-os";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";
import { useAutoUpdater } from "../useAutoUpdater";

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuthContext: () => ({ license: null, isInitialized: false }),
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "0.13.0" }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos", arch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("Intel transition app never checks or installs a newer release", async () => {
  vi.mocked(arch).mockReturnValue("x86_64");
  const { result } = renderHook(() => useAutoUpdater());
  await act(async () => { expect(await result.current.checkForUpdates()).toBe(false); });
  await act(async () => { await result.current.handleUpdate(); });
  expect(check).not.toHaveBeenCalled();
  expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("final version for Intel"), expect.any(Object));
  expect(toast.success).not.toHaveBeenCalled();
});

test("Apple Silicon continues checking its configured updater feed", async () => {
  vi.mocked(arch).mockReturnValue("aarch64");
  const { result } = renderHook(() => useAutoUpdater());
  await act(async () => { await result.current.checkForUpdates(); });
  expect(check).toHaveBeenCalledOnce();
});
