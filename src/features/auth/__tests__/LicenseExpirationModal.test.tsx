import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LicenseExpirationModal from "../LicenseExpirationModal";
import type { StoredLicense } from "../types";

const {
  mockActivateLicense,
  mockRefreshLicense,
  mockSetLicenseModalDismissed,
} = vi.hoisted(() => ({
  mockActivateLicense: vi.fn(),
  mockRefreshLicense: vi.fn(),
  mockSetLicenseModalDismissed: vi.fn(),
}));

const expiredTrialLicense: StoredLicense = {
  uuid: "expired-trial-license",
  type: "trial",
  license_key: null,
  expires_at: new Date(Date.now() - 60_000).toISOString(),
  last_checked_at: new Date().toISOString(),
  ai_expires_at: new Date(Date.now() - 60_000).toISOString(),
  updates_expires_at: new Date(Date.now() - 60_000).toISOString(),
};

vi.mock("../AuthProvider", () => ({
  useAuthContext: () => ({
    activateLicense: mockActivateLicense,
    refreshLicense: mockRefreshLicense,
    isInitialized: true,
    license: expiredTrialLicense,
    isLicenseActive: false,
  }),
}));

vi.mock("../services", () => ({
  LicenseService: {
    isExpiredTrial: vi.fn().mockReturnValue(true),
    isLicenseModalDismissed: vi.fn().mockResolvedValue(false),
    setLicenseModalDismissed: mockSetLicenseModalDismissed,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

describe("LicenseExpirationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivateLicense.mockResolvedValue(null);
    mockRefreshLicense.mockResolvedValue(null);
    mockSetLicenseModalDismissed.mockResolvedValue(undefined);
  });

  it("shows activation form when clicking Activate License", () => {
    render(
      <LicenseExpirationModal
        open={true}
        trialEndDate={expiredTrialLicense.expires_at ?? undefined}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Activate License|Upgrade Now/i })
    );

    expect(
      screen.getByPlaceholderText("Enter your license key")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activate License" })
    ).toBeInTheDocument();
  });
});
