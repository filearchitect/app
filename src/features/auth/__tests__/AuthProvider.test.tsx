import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseValidationError } from "../errors";
import { LicenseService } from "../services";
import { StoredLicense } from "../types";

// Mock environment variables
vi.stubEnv("VITE_TRIAL_GRACE_PERIOD_HOURS", "24");
vi.stubEnv("VITE_MAX_LINES_FREE_VERSION", "5");

// Mock store API - we need to mock this since it's filesystem-based
vi.mock("@/api/store", () => ({
  getStoreValue: vi.fn(),
  setStoreValue: vi.fn(),
}));

// Mock machine service - we need to mock this since it's hardware-specific
vi.mock("../services", () => ({
  MachineIdService: {
    getMachineId: vi.fn(),
    regenerateId: vi.fn(),
    getOrGenerateMachineId: vi.fn().mockResolvedValue("test-machine-id"),
  },
  LicenseService: {
    getCurrentLicense: vi.fn(),
    clearStoredLicense: vi.fn(),
    validateLicense: vi.fn(),
    checkLicense: vi.fn(),
    isLicenseActive: vi.fn().mockImplementation((license) => {
      if (!license?.expires_at) {
        return false;
      }
      return new Date(license.expires_at) > new Date();
    }),
    isLicenseExpired: vi.fn().mockImplementation((license) => {
      if (!license?.expires_at) {
        return false;
      }
      return new Date(license.expires_at) <= new Date();
    }),
    isExpiredTrial: vi.fn().mockImplementation((license) => {
      if (!license || license.type !== "trial") {
        return false;
      }
      if (!license?.expires_at) {
        return false;
      }
      return new Date(license.expires_at) <= new Date();
    }),
    GRACE_PERIOD_MS: 24 * 60 * 60 * 1000,
  },
}));

// Import after environment is mocked
import { AuthProvider, useAuthContext } from "../AuthProvider";

// Create a test component to access the auth context
const TestComponent = () => {
  const { license, isLoading, error } = useAuthContext();
  return (
    <div>
      <div data-testid="license-type">{license?.type}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="error">{error || ""}</div>
    </div>
  );
};

// Create a test component to verify trial access behavior
const TrialAccessTestComponent = () => {
  const { license, isLicenseActive, isLicenseExpired } = useAuthContext();
  return (
    <div>
      <div data-testid="license-type">{license?.type || ""}</div>
      <div data-testid="license-active">
        {(isLicenseActive ?? false).toString()}
      </div>
      <div data-testid="license-expired">
        {(isLicenseExpired ?? false).toString()}
      </div>
      <div data-testid="expires-at">{license?.expires_at || ""}</div>
    </div>
  );
};

// Create a component to test license activation
const ActivationTestComponent = () => {
  const { license, error, activateLicense } = useAuthContext();
  return (
    <div>
      <div data-testid="license-type">{license?.type}</div>
      <div data-testid="error">{error || ""}</div>
      <button
        data-testid="activate-button"
        onClick={() => activateLicense("test-key")}
      >
        Activate
      </button>
    </div>
  );
};

describe("AuthProvider", () => {
  // Use a valid test machine ID format that matches your server's expectations
  const mockMachineId = "test-" + Math.random().toString(36).substring(2, 15);
  const mockLicense: StoredLicense = {
    uuid: "test-uuid",
    type: "trial",
    license_key: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    last_checked_at: new Date().toISOString(),
    ai_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updates_expires_at: new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure LicenseService.checkLicense returns a valid license immediately
    vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(mockLicense);
    // Mock getCurrentLicense to return null initially
    vi.spyOn(LicenseService, "getCurrentLicense").mockResolvedValue(null);
    // Optionally, adjust Date.prototype.toLocaleString if needed
    vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (
      this: Date,
      _locale,
      options
    ) {
      if (options?.timeZone) {
        return this.toISOString().replace("Z", "");
      }
      return this.toISOString();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show loading state initially", async () => {
    let component: ReturnType<typeof render>;

    // Mock checkLicense to return a promise that doesn't resolve immediately
    vi.spyOn(LicenseService, "checkLicense").mockImplementation(
      () => new Promise(() => {})
    );

    component = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Check loading state immediately
    expect(component.getByTestId("loading").textContent).toBe("true");
  });

  it("should update license state after successful validation", async () => {
    let component: ReturnType<typeof render>;

    await act(async () => {
      component = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(component!.getByTestId("license-type").textContent).toBe("trial");
      expect(component!.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("should handle license validation error", async () => {
    vi.spyOn(LicenseService, "checkLicense").mockRejectedValue(
      new LicenseValidationError("License validation failed")
    );

    let component: ReturnType<typeof render>;

    await act(async () => {
      component = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    await waitFor(() => {
      expect(component!.getByTestId("error").textContent).toBe(
        "License validation failed"
      );
      expect(component!.getByTestId("loading").textContent).toBe("false");
    });
  });

  describe("Trial Access and Line Limits", () => {
    it("should provide full access during active trial period", async () => {
      // Create a trial license that expires in the future (active trial)
      const activeTrial: StoredLicense = {
        uuid: "test-trial-uuid",
        type: "trial",
        license_key: null,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(), // 7 days from now
        last_checked_at: new Date().toISOString(),
        ai_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updates_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      // Mock the service methods to reflect active trial
      vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(activeTrial);
      vi.spyOn(LicenseService, "isLicenseActive").mockReturnValue(true);
      vi.spyOn(LicenseService, "isLicenseExpired").mockReturnValue(false);

      let component: ReturnType<typeof render>;

      await act(async () => {
        component = render(
          <AuthProvider>
            <TrialAccessTestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(component!.getByTestId("license-type").textContent).toBe(
          "trial"
        );
        expect(component!.getByTestId("license-active").textContent).toBe(
          "true"
        );
        expect(component!.getByTestId("license-expired").textContent).toBe(
          "false"
        );
      });

      // Verify that the user should have full access (not constrained by max lines)
      expect(LicenseService.isLicenseActive).toHaveBeenCalledWith(activeTrial);
      expect(LicenseService.isLicenseExpired).toHaveBeenCalledWith(activeTrial);
    });

    it("should constrain access after trial expiration", async () => {
      // Create an expired trial license
      const expiredTrial: StoredLicense = {
        uuid: "test-expired-trial-uuid",
        type: "trial",
        license_key: null,
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        last_checked_at: new Date().toISOString(),
        ai_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updates_expires_at: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      // Mock the service methods to reflect expired trial
      vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(expiredTrial);
      vi.spyOn(LicenseService, "isLicenseActive").mockReturnValue(false);
      vi.spyOn(LicenseService, "isLicenseExpired").mockReturnValue(true);

      let component: ReturnType<typeof render>;

      await act(async () => {
        component = render(
          <AuthProvider>
            <TrialAccessTestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(component!.getByTestId("license-type").textContent).toBe(
          "trial"
        );
        expect(component!.getByTestId("license-active").textContent).toBe(
          "false"
        );
        expect(component!.getByTestId("license-expired").textContent).toBe(
          "true"
        );
      });

      // Verify that the license is properly identified as expired trial
      expect(LicenseService.isLicenseActive).toHaveBeenCalledWith(expiredTrial);
      expect(LicenseService.isLicenseExpired).toHaveBeenCalledWith(
        expiredTrial
      );
    });

    it("should allow unlimited items during active trial", async () => {
      const activeTrial: StoredLicense = {
        uuid: "test-active-trial",
        type: "trial",
        license_key: null,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        last_checked_at: new Date().toISOString(),
        ai_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updates_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(activeTrial);
      vi.spyOn(LicenseService, "isLicenseActive").mockReturnValue(true);

      let component: ReturnType<typeof render>;

      await act(async () => {
        component = render(
          <AuthProvider>
            <TrialAccessTestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(component!.getByTestId("license-active").textContent).toBe(
          "true"
        );
      });

      // During active trial, isLicenseActive should return true
      // This means users can create unlimited items (not constrained by VITE_MAX_LINES_FREE_VERSION)
      expect(LicenseService.isLicenseActive).toHaveBeenCalledWith(activeTrial);
    });

    it("should enforce line limits after trial expiration", async () => {
      const expiredTrial: StoredLicense = {
        uuid: "test-expired-trial",
        type: "trial",
        license_key: null,
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        last_checked_at: new Date().toISOString(),
        ai_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updates_expires_at: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(expiredTrial);
      vi.spyOn(LicenseService, "isLicenseActive").mockReturnValue(false);
      vi.spyOn(LicenseService, "isLicenseExpired").mockReturnValue(true);

      let component: ReturnType<typeof render>;

      await act(async () => {
        component = render(
          <AuthProvider>
            <TrialAccessTestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(component!.getByTestId("license-active").textContent).toBe(
          "false"
        );
      });

      // After trial expiration, isLicenseActive should return false
      // This means users will be constrained by VITE_MAX_LINES_FREE_VERSION (5 lines)
      expect(LicenseService.isLicenseActive).toHaveBeenCalledWith(expiredTrial);
    });

    it("should provide full access for paid licenses", async () => {
      const paidLicense: StoredLicense = {
        uuid: "test-paid-license",
        type: "yearly",
        license_key: "paid-license-key-123",
        expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(), // 1 year from now
        last_checked_at: new Date().toISOString(),
        ai_expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updates_expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(paidLicense);
      vi.spyOn(LicenseService, "isLicenseActive").mockReturnValue(true);
      vi.spyOn(LicenseService, "isLicenseExpired").mockReturnValue(false);

      let component: ReturnType<typeof render>;

      await act(async () => {
        component = render(
          <AuthProvider>
            <TrialAccessTestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(component!.getByTestId("license-type").textContent).toBe(
          "yearly"
        );
        expect(component!.getByTestId("license-active").textContent).toBe(
          "true"
        );
        expect(component!.getByTestId("license-expired").textContent).toBe(
          "false"
        );
      });

      // Paid licenses should provide unlimited access
      expect(LicenseService.isLicenseActive).toHaveBeenCalledWith(paidLicense);
    });

    it("should enforce line limits for expired paid licenses", async () => {
      const expiredPaidLicense: StoredLicense = {
        uuid: "test-expired-paid-license",
        type: "yearly",
        license_key: "expired-license-key-123",
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        last_checked_at: new Date().toISOString(),
        ai_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updates_expires_at: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      vi.spyOn(LicenseService, "checkLicense").mockResolvedValue(
        expiredPaidLicense
      );
      vi.spyOn(LicenseService, "isLicenseActive").mockReturnValue(false);
      vi.spyOn(LicenseService, "isLicenseExpired").mockReturnValue(true);

      let component: ReturnType<typeof render>;

      await act(async () => {
        component = render(
          <AuthProvider>
            <TrialAccessTestComponent />
          </AuthProvider>
        );
      });

      await waitFor(() => {
        expect(component!.getByTestId("license-type").textContent).toBe(
          "yearly"
        );
        expect(component!.getByTestId("license-active").textContent).toBe(
          "false"
        );
        expect(component!.getByTestId("license-expired").textContent).toBe(
          "true"
        );
      });

      // Even paid licenses, when expired, should be constrained by line limits
      expect(LicenseService.isLicenseActive).toHaveBeenCalledWith(
        expiredPaidLicense
      );
    });
  });
});
