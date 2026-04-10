import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSetappLicense,
  createSetappLicenseFromStatus,
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

  it("projects native Setapp status into a stored license", () => {
    const license = createSetappLicenseFromStatus(
      {
        enabled: true,
        available: true,
        active: false,
        source: "setapp",
        purchase_type: "single_app",
        expiration_date: "2026-05-01T00:00:00.000Z",
      },
      "2026-04-01T00:00:00.000Z"
    );

    expect(license.source).toBe("setapp");
    expect(license.type).toBe("once");
    expect(license.expires_at).toBe("2026-05-01T00:00:00.000Z");
    expect(license.purchase_type).toBe("single_app");
    expect(license.setapp_status?.active).toBe(false);
    expect(license.setapp_status?.available).toBe(true);
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
    const invoke = vi.fn().mockImplementation((command: string) => {
      if (command === "get_setapp_status") {
        return Promise.resolve({
          enabled: true,
          available: true,
          active: true,
          source: "setapp",
          purchase_type: null,
          expiration_date: null,
        });
      }

      return Promise.resolve(null);
    });

    vi.doMock("@/api/http", () => ({
      makeApiRequest,
    }));
    vi.doMock("@/api/store", () => ({
      getStoreValue,
      setStoreValue,
    }));
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke,
    }));
    vi.doMock("@tauri-apps/api/path", () => ({
      documentDir: vi.fn(),
      homeDir: vi.fn(),
      join: vi.fn(),
    }));
    vi.doMock("@tauri-apps/plugin-fs", () => ({
      exists: vi.fn(),
      readTextFile: vi.fn(),
    }));

    const { LicenseService } = await import("../services");

    const license = await LicenseService.checkLicense();

    expect(license?.source).toBe("setapp");
    expect(license?.setapp_status?.active).toBe(true);
    expect(invoke).toHaveBeenCalledWith("get_setapp_status");
    expect(makeApiRequest).not.toHaveBeenCalled();
    expect(getStoreValue).not.toHaveBeenCalled();
    expect(setStoreValue).toHaveBeenCalledTimes(1);
  });

  it("uses a local Setapp override from ~/fa.json when present", async () => {
    vi.stubEnv("VITE_IS_SETAPP", "true");
    vi.stubEnv("VITE_SETAPP_LOCAL_TEST", "true");

    const makeApiRequest = vi.fn();
    const getStoreValue = vi.fn().mockResolvedValue(null);
    const setStoreValue = vi.fn().mockResolvedValue(undefined);
    const invoke = vi.fn();
    const homeDir = vi.fn().mockResolvedValue("/Users/test");
    const documentDir = vi.fn().mockResolvedValue("/Users/test/Documents");
    const join = vi.fn((base: string, file: string) =>
      Promise.resolve(`${base}/${file}`)
    );
    const exists = vi.fn((path: string) =>
      Promise.resolve(path === "/Users/test/fa.json")
    );
    const readTextFile = vi.fn().mockResolvedValue(
      JSON.stringify({
        setapp: {
          active: true,
          available: true,
          purchaseType: "single_app",
        },
      })
    );

    vi.doMock("@/api/http", () => ({
      makeApiRequest,
    }));
    vi.doMock("@/api/store", () => ({
      getStoreValue,
      setStoreValue,
    }));
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke,
    }));
    vi.doMock("@tauri-apps/api/path", () => ({
      documentDir,
      homeDir,
      join,
    }));
    vi.doMock("@tauri-apps/plugin-fs", () => ({
      exists,
      readTextFile,
    }));

    const { LicenseService } = await import("../services");

    const license = await LicenseService.checkLicense();

    expect(license?.source).toBe("setapp");
    expect(license?.setapp_status?.active).toBe(true);
    expect(license?.purchase_type).toBe("single_app");
    expect(invoke).not.toHaveBeenCalled();
    expect(makeApiRequest).not.toHaveBeenCalled();
  });

  it("ignores a local Setapp override in the real Setapp build", async () => {
    vi.stubEnv("VITE_IS_SETAPP", "true");

    const makeApiRequest = vi.fn();
    const getStoreValue = vi.fn().mockResolvedValue(null);
    const setStoreValue = vi.fn().mockResolvedValue(undefined);
    const invoke = vi.fn().mockImplementation((command: string) => {
      if (command === "get_setapp_status") {
        return Promise.resolve({
          enabled: true,
          available: true,
          active: false,
          source: "setapp",
          purchase_type: null,
          expiration_date: null,
        });
      }

      return Promise.resolve(null);
    });
    const homeDir = vi.fn().mockResolvedValue("/Users/test");
    const documentDir = vi.fn().mockResolvedValue("/Users/test/Documents");
    const join = vi.fn((base: string, file: string) =>
      Promise.resolve(`${base}/${file}`)
    );
    const exists = vi.fn((path: string) =>
      Promise.resolve(path === "/Users/test/fa.json")
    );
    const readTextFile = vi.fn().mockResolvedValue(
      JSON.stringify({
        setapp: {
          active: true,
          available: true,
          purchaseType: "single_app",
        },
      })
    );

    vi.doMock("@/api/http", () => ({
      makeApiRequest,
    }));
    vi.doMock("@/api/store", () => ({
      getStoreValue,
      setStoreValue,
    }));
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke,
    }));
    vi.doMock("@tauri-apps/api/path", () => ({
      documentDir,
      homeDir,
      join,
    }));
    vi.doMock("@tauri-apps/plugin-fs", () => ({
      exists,
      readTextFile,
    }));

    const { LicenseService } = await import("../services");

    const license = await LicenseService.checkLicense();

    expect(license?.source).toBe("setapp");
    expect(license?.setapp_status?.active).toBe(false);
    expect(license?.purchase_type).toBeNull();
    expect(invoke).toHaveBeenCalledWith("get_setapp_status");
    expect(readTextFile).not.toHaveBeenCalled();
    expect(makeApiRequest).not.toHaveBeenCalled();
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
