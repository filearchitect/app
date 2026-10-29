import { makeApiRequest } from "@/api/http";
import { setStoreValue } from "@/api/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseValidationError } from "../errors";
import { LicenseService, MachineIdService } from "../services";
import { ServerLicense } from "../types";

vi.mock("@/api/http", () => ({ makeApiRequest: vi.fn() }));
vi.mock("@/api/store", () => ({
  getStoreValue: vi.fn(),
  setStoreValue: vi.fn(),
}));

describe("direct license activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setStoreValue).mockResolvedValue(undefined);
    vi.spyOn(MachineIdService, "getOrGenerateMachineId").mockResolvedValue("test-machine");
  });

  it("persists a valid paid license for the next launch", async () => {
    const response: ServerLicense = {
      uuid: "paid-uuid",
      type: "yearly",
      license_key: null,
      active: true,
      expires_at: "2027-12-01T00:00:00Z",
      ai_expires_at: null,
      updates_expires_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(makeApiRequest).mockResolvedValue(response);

    const license = await LicenseService.validateLicense("FA-TEST-KEY");

    expect(makeApiRequest).toHaveBeenCalledWith("/licenses/validation", {
      license_key: "FA-TEST-KEY",
      machine_name: "test-machine",
    });
    expect(license).toMatchObject({
      uuid: "paid-uuid",
      source: "direct",
      license_key: "FA-TEST-KEY",
    });
    expect(setStoreValue).toHaveBeenCalledWith("license", license);
  });

  it("rejects a machine-limit response without replacing the stored license", async () => {
    vi.mocked(makeApiRequest).mockResolvedValue({
      valid: false,
      message: "License FA-TEST-KEY has reached the maximum number of machines",
    });

    await expect(LicenseService.validateLicense("FA-TEST-KEY")).rejects.toThrow(
      "License [redacted] has reached the maximum number of machines"
    );
    expect(setStoreValue).not.toHaveBeenCalled();
  });

  it("rejects malformed success responses without storing them", async () => {
    vi.mocked(makeApiRequest).mockResolvedValue({ uuid: "incomplete" });

    await expect(LicenseService.validateLicense("FA-TEST-KEY")).rejects.toThrow(
      LicenseValidationError
    );
    expect(setStoreValue).not.toHaveBeenCalled();
  });
});
