import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  getStoreValue: vi.fn(),
  setStoreValue: vi.fn(),
  getStore: vi.fn(),
  clearStore: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/api/store", () => ({
  getStoreValue: storeMocks.getStoreValue,
  setStoreValue: storeMocks.setStoreValue,
  getStore: storeMocks.getStore,
  clearStore: storeMocks.clearStore,
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn().mockResolvedValue("0.11.22"),
}));

vi.mock("@/features/structureEditor/utils/folderUtils", () => ({
  expandPath: vi.fn().mockResolvedValue("/tmp"),
}));

vi.mock("@/features/updater/useAutoUpdater", () => ({
  useAutoUpdater: () => ({
    handleUpdate: vi.fn(),
    isUpdating: false,
    showUpdateDialog: false,
    setShowUpdateDialog: vi.fn(),
    updateInfo: null,
    isRestartReady: false,
    lastUpdateError: null,
  }),
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuthContext: () => ({
    license: {
      uuid: "setapp-license",
      source: "setapp",
      type: "once",
      license_key: null,
      expires_at: null,
      ai_expires_at: null,
      updates_expires_at: null,
      last_checked_at: "2026-04-01T00:00:00.000Z",
      purchase_type: "single_app",
      setapp_status: {
        enabled: true,
        available: true,
        active: true,
        source: "setapp",
        purchase_type: "single_app",
        expiration_date: null,
      },
    },
    isLoading: false,
    error: null,
    activateLicense: vi.fn(),
    refreshLicense: vi.fn(),
  }),
}));

import { WelcomeDialog } from "@/components/WelcomeDialog";
import GeneralPreferences from "../GeneralPreferences";
import AccountPreferences from "../AccountPreferences";

describe("Setapp review-facing UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_IS_SETAPP", "true");
    storeMocks.getStoreValue.mockResolvedValue(false);
    storeMocks.setStoreValue.mockResolvedValue(undefined);
    storeMocks.clearStore.mockResolvedValue(undefined);
    storeMocks.getStore.mockResolvedValue({
      entries: vi.fn().mockResolvedValue([]),
    });
  });

  it("uses Setapp-specific welcome copy", () => {
    render(<WelcomeDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/setapp includes full core access/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/purchase a license/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/7-day trial/i)).not.toBeInTheDocument();
  });

  it("shows Setapp one-time access details in account preferences", () => {
    render(<AccountPreferences />);

    expect(screen.getByText("Setapp Access")).toBeInTheDocument();
    expect(screen.getAllByText("single app")).toHaveLength(1);
    expect(screen.getByText("Access Status")).toBeInTheDocument();
    expect(screen.queryByText("Distribution")).not.toBeInTheDocument();
    expect(
      screen.getByText(/updates and access are managed by setapp/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/manage license/i)
    ).not.toBeInTheDocument();
  });

  it("hides direct-license updater renewal messaging for Setapp users", async () => {
    render(<GeneralPreferences />);

    expect(
      await screen.findByText(/updates for this build are managed by setapp/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/renew your license to get updates/i)
    ).not.toBeInTheDocument();
  });
});
