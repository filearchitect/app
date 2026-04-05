import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSetappLicense,
  getLicenseEntitlements,
  getLicenseSource,
  isSetappLicense,
} from "../setapp";
import { StoredLicense } from "../types";

describe("Setapp license helpers", () => {
  it("creates a Setapp license with no direct-sale license key", () => {
    const license = createSetappLicense("2026-04-01T00:00:00.000Z");

    expect(license.source).toBe("setapp");
    expect(license.type).toBe("once");
    expect(license.license_key).toBeNull();
    expect(license.expires_at).toBeNull();
    expect(license.ai_expires_at).toBeNull();
    expect(license.updates_expires_at).toBeNull();
    expect(isSetappLicense(license)).toBe(true);
  });

  it("reports Setapp as full core access without AI or license management", () => {
    const entitlements = getLicenseEntitlements(
      createSetappLicense("2026-04-01T00:00:00.000Z")
    );

    expect(entitlements.source).toBe("setapp");
    expect(entitlements.hasCoreAccess).toBe(true);
    expect(entitlements.hasAiAccess).toBe(false);
    expect(entitlements.canManageLicense).toBe(false);
    expect(entitlements.isNonExpiringCoreAccess).toBe(true);
  });

  it("treats active direct trial access as expiring and manageable", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const license: StoredLicense = {
      uuid: "trial-license",
      source: "trial",
      type: "trial",
      license_key: null,
      expires_at: future,
      ai_expires_at: future,
      updates_expires_at: future,
      last_checked_at: "2026-04-01T00:00:00.000Z",
    };

    const entitlements = getLicenseEntitlements(license);

    expect(getLicenseSource(license)).toBe("trial");
    expect(entitlements.hasCoreAccess).toBe(true);
    expect(entitlements.hasAiAccess).toBe(true);
    expect(entitlements.canManageLicense).toBe(true);
    expect(entitlements.isNonExpiringCoreAccess).toBe(false);
  });

  it("infers direct source for existing paid licenses without an explicit source", () => {
    const license: StoredLicense = {
      uuid: "paid-license",
      type: "once",
      license_key: "paid-key",
      expires_at: null,
      ai_expires_at: null,
      updates_expires_at: null,
      last_checked_at: "2026-04-01T00:00:00.000Z",
    };

    const entitlements = getLicenseEntitlements(license);

    expect(getLicenseSource(license)).toBe("direct");
    expect(entitlements.hasCoreAccess).toBe(true);
    expect(entitlements.hasAiAccess).toBe(false);
    expect(entitlements.canManageLicense).toBe(true);
    expect(entitlements.isNonExpiringCoreAccess).toBe(true);
  });
});

describe("Setapp auth resolution", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("bypasses licensing endpoints when running in Setapp mode", async () => {
    vi.stubEnv("VITE_IS_SETAPP", "true");

    const makeApiRequest = vi.fn();
    const getStoreValue = vi.fn().mockResolvedValue(null);
    const setStoreValue = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/api/http", () => ({
      makeApiRequest,
    }));
    vi.doMock("@/api/store", () => ({
      getStoreValue,
      setStoreValue,
    }));
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: vi.fn(),
    }));
    vi.doMock("@tauri-apps/api/path", () => ({
      documentDir: vi.fn(),
      join: vi.fn(),
    }));
    vi.doMock("@tauri-apps/plugin-fs", () => ({
      exists: vi.fn(),
      readTextFile: vi.fn(),
    }));

    const { LicenseService } = await import("../services");

    const license = await LicenseService.checkLicense();

    expect(license?.source).toBe("setapp");
    expect(makeApiRequest).not.toHaveBeenCalled();
    expect(getStoreValue).not.toHaveBeenCalled();
    expect(setStoreValue).toHaveBeenCalledTimes(1);
  });

  it("initializes the auth provider from a Setapp entitlement", async () => {
    const setappLicense = createSetappLicense("2026-04-01T00:00:00.000Z");

    vi.doMock("../services", () => ({
      LicenseService: {
        checkLicense: vi.fn().mockResolvedValue(setappLicense),
        validateLicense: vi.fn(),
        getCurrentLicense: vi.fn(),
        clearStoredLicense: vi.fn(),
        isLicenseActive: vi.fn().mockReturnValue(true),
        isLicenseExpired: vi.fn().mockReturnValue(false),
      },
    }));

    const { AuthProvider, useAuthContext } = await import("../AuthProvider");

    const TestComponent = () => {
      const { license, isLicenseActive, isLicenseExpired } = useAuthContext();

      return (
        <div>
          <div data-testid="license-source">{license?.source ?? ""}</div>
          <div data-testid="license-type">{license?.type ?? ""}</div>
          <div data-testid="license-active">{String(isLicenseActive)}</div>
          <div data-testid="license-expired">{String(isLicenseExpired)}</div>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("license-source").textContent).toBe("setapp");
      expect(screen.getByTestId("license-type").textContent).toBe("once");
      expect(screen.getByTestId("license-active").textContent).toBe("true");
      expect(screen.getByTestId("license-expired").textContent).toBe("false");
    });
  });
});
