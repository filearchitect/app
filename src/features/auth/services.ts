import { makeApiRequest } from "@/api/http";
import { getStoreValue, setStoreValue } from "@/api/store";
import { invoke } from "@tauri-apps/api/core";
import { documentDir, join } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { LicenseError, LicenseValidationError, MachineIdError } from "./errors";
import { ServerLicense, ServerMachineResponse, StoredLicense } from "./types";

const MACHINE_ID_KEY = "machineId";
const LICENSE_KEY = "license";
const LICENSE_MODAL_DISMISSED_KEY = "licenseModalDismissed";

// Convert hours to milliseconds, default to 24 hours if not set
const GRACE_PERIOD_MS =
  parseInt(import.meta.env.VITE_LICENSE_CHECK_GRACE_PERIOD_HOURS || "24", 10) *
  60 *
  60 *
  1000;

interface OverrideSettings {
  machineId?: string;
}

/**
 * Reads override settings from ~/Documents/fa.json
 * @returns Override settings object or null if file doesn't exist or is invalid
 */
async function readOverrideSettings(): Promise<OverrideSettings | null> {
  try {
    const documentsPath = await documentDir();
    const overrideFilePath = await join(documentsPath, "fa.json");

    const fileExists = await exists(overrideFilePath);
    if (!fileExists) {
      return null;
    }

    const fileContent = await readTextFile(overrideFilePath);
    const settings = JSON.parse(fileContent) as OverrideSettings;

    console.log(
      "🔧 Override settings loaded from ~/Documents/fa.json:",
      settings
    );
    return settings;
  } catch (error) {
    console.error(
      "Failed to read override settings from ~/Documents/fa.json:",
      error
    );
    return null;
  }
}

function hashString(str: string): string {
  // Simple implementation of djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex and take first 12 characters for a nice length
  const hexHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `fa-${hexHash}`;
}

export class MachineIdService {
  private static cachedMachineId: string | null = null;

  static async getMachineId(): Promise<string | null> {
    try {
      // Check for override from ~/Documents/fa.json first
      const overrideSettings = await readOverrideSettings();
      if (overrideSettings?.machineId) {
        console.log(
          `🔧 Using machine ID override from ~/Documents/fa.json: ${overrideSettings.machineId}`
        );
        return overrideSettings.machineId;
      }

      // Development override for testing different machine IDs
      if (import.meta.env.DEV && import.meta.env.VITE_OVERRIDE_MACHINE_ID) {
        const overrideId = import.meta.env.VITE_OVERRIDE_MACHINE_ID as string;
        console.log(`🔧 Development override: Using machine ID ${overrideId}`);
        return overrideId;
      }

      if (this.cachedMachineId) {
        return this.cachedMachineId;
      }

      const storedId = await getStoreValue<string>(MACHINE_ID_KEY);
      if (storedId) {
        this.cachedMachineId = storedId;
        return storedId;
      }

      const hardwareUuid = await invoke<string>("get_hardware_uuid");
      const id = hashString(hardwareUuid);
      await setStoreValue(MACHINE_ID_KEY, id);
      this.cachedMachineId = id;
      return id;
    } catch (error) {
      console.error("Error getting machine ID:", error);
      throw new MachineIdError("Failed to get machine ID", error);
    }
  }

  static async clearMachineId(): Promise<void> {
    try {
      await setStoreValue(MACHINE_ID_KEY, null);
      this.cachedMachineId = null;
    } catch (error) {
      console.error("Error clearing machine ID:", error);
      throw new MachineIdError("Failed to clear machine ID", error);
    }
  }

  static async regenerateId(): Promise<string> {
    try {
      await this.clearMachineId();
      const newId = await this.getMachineId();
      if (!newId) {
        throw new MachineIdError("Failed to generate new machine ID");
      }
      return newId;
    } catch (error) {
      if (error instanceof MachineIdError) {
        throw error;
      }
      throw new MachineIdError("Failed to regenerate machine ID", error);
    }
  }

  static async getOrGenerateMachineId(): Promise<string> {
    try {
      let id = await this.getMachineId();
      if (!id) {
        id = await this.regenerateId();
      }
      return id;
    } catch (error) {
      if (error instanceof MachineIdError) {
        throw error;
      }
      throw new MachineIdError("Failed to get or generate machine ID", error);
    }
  }
}

export class LicenseService {
  static readonly GRACE_PERIOD_MS = GRACE_PERIOD_MS;

  static async getCurrentLicense(): Promise<StoredLicense | null> {
    try {
      return await getStoreValue<StoredLicense>(LICENSE_KEY);
    } catch (error) {
      throw new LicenseError("Failed to get current license", error);
    }
  }

  static async clearStoredLicense(): Promise<void> {
    try {
      await setStoreValue(LICENSE_KEY, null);
    } catch (error) {
      throw new LicenseError("Failed to clear stored license", error);
    }
  }
  /**
   * Converts a server license response to a stored license format
   * @param serverLicense The server license response
   * @param licenseKey Optional license key to include
   * @returns StoredLicense object
   */
  private static convertToStoredLicense(
    serverLicense: ServerLicense,
    licenseKey?: string
  ): StoredLicense {
    return {
      uuid: serverLicense.uuid,
      type: serverLicense.type,
      license_key: licenseKey || serverLicense.license_key,
      expires_at: serverLicense.expires_at,
      ai_expires_at: serverLicense.ai_expires_at,
      updates_expires_at: serverLicense.updates_expires_at,
      last_checked_at: new Date().toISOString(),
    };
  }

  /**
   * Updates the license from the server or creates
   * a trial license if no license is found
   * @returns The license
   */
  static async updateLicenseOrCreateTrial(): Promise<StoredLicense> {
    const machineId = await MachineIdService.getOrGenerateMachineId();
    const response = await makeApiRequest<ServerMachineResponse>("/machines", {
      machine_name: machineId,
    });

    console.log("response from updateLicenseOrCreateTrial", response);

    const trialLicense = this.convertToStoredLicense(response.data.license);
    await setStoreValue(LICENSE_KEY, trialLicense);
    return trialLicense;
  }

  /**
   * Validates the license with the server and updates the local license.
   * @param licenseKey The license key to validate
   * @returns The updated license
   */
  static async validateLicense(licenseKey: string): Promise<StoredLicense> {
    const validationResponse = await makeApiRequest<ServerLicense>(
      "/licenses/validation",
      {
        license_key: licenseKey,
        machine_name: await MachineIdService.getOrGenerateMachineId(),
      }
    );

    return this.convertToStoredLicense(validationResponse, licenseKey);
  }

  /**
   * Checks if the license is within the grace period.
   * The reason for the grace period is to not call the server too often.
   *  and let the user be able to use the app offline for a bit.
   * @param license The license to check
   * @returns True if the license is within the grace period, false otherwise
   */
  static async checkifwithingraceperiod(
    license: StoredLicense
  ): Promise<boolean> {
    const currentTime = new Date();
    const gracePeriodEnd = new Date(license.last_checked_at);
    gracePeriodEnd.setMilliseconds(
      gracePeriodEnd.getMilliseconds() + GRACE_PERIOD_MS
    );
    return currentTime <= gracePeriodEnd;
  }

  /**
   * Checks if the license is active (not expired) and provides full app access
   * @param license The license to check
   * @returns True if the license provides full access (active trial or paid license not expired), false for expired licenses
   */
  static isLicenseActive(license: StoredLicense): boolean {
    console.log("license!!!", license);

    // Check if license is expired
    if (this.isLicenseExpired(license)) {
      return false;
    }

    // For active trials and paid licenses, return true
    return true;
  }

  /**
   * Checks if the license is expired
   * @param license The license to check
   * @returns True if the license is expired, false otherwise
   */
  static isLicenseExpired(license: StoredLicense): boolean {
    if (license.expires_at === null) {
      return false;
    }

    return new Date(license.expires_at) <= new Date();
  }

  /**
   * Checks if the license is an expired trial
   * @param license The license to check
   * @returns True if the license is a trial and expired, false otherwise
   */
  static isExpiredTrial(license: StoredLicense): boolean {
    return license.type === "trial" && this.isLicenseExpired(license);
  }

  /**
   * Checks the license and updates the local license.
   * @returns The license
   */
  static async checkLicense(): Promise<StoredLicense | null> {
    // Development override for testing different license types
    if (import.meta.env.DEV && import.meta.env.VITE_OVERRIDE_LICENSE) {
      const overrideType = import.meta.env.VITE_OVERRIDE_LICENSE as
        | "none"
        | "trial"
        | "trial_expired"
        | "once"
        | "yearly"
        | "yearly_expired";
      console.log(`🔧 Development override: Using ${overrideType} license mode`);

      if (overrideType === "none") {
        await this.clearStoredLicense();
        return null;
      }

      const isTrialLike =
        overrideType === "trial" || overrideType === "trial_expired";
      const normalizedType: "trial" | "once" | "yearly" =
        overrideType === "trial_expired"
          ? "trial"
          : overrideType === "yearly_expired"
          ? "yearly"
          : overrideType;

      // Create mock license based on override type
      const mockLicense: StoredLicense = {
        uuid: `dev-override-${overrideType}-${Date.now()}`,
        type: normalizedType,
        license_key: isTrialLike ? null : `dev-${normalizedType}-key`,
        expires_at: this.getMockExpirationDate(overrideType),
        ai_expires_at:
          isTrialLike
            ? null
            : overrideType === "yearly_expired"
            ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year for non-trial
        updates_expires_at:
          isTrialLike
            ? null
            : overrideType === "yearly_expired"
            ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year for non-trial
        last_checked_at: new Date().toISOString(),
      };

      // Store the mock license
      await setStoreValue(LICENSE_KEY, mockLicense);
      return mockLicense;
    }

    try {
      const currentLicense = await this.getCurrentLicense();

      console.log("currentLicense", currentLicense);

      // If no local license is set, create a trial license
      if (!currentLicense) {
        console.log("no current license, creating trial license");
        const trialLicense = await this.updateLicenseOrCreateTrial();
        return trialLicense;
      }

      const withinGracePeriod =
        await this.checkifwithingraceperiod(currentLicense);

      if (!withinGracePeriod) {
        console.log("withinGracePeriod", withinGracePeriod);
        return this.updateLicenseOrCreateTrial();
      }

      return currentLicense;
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error && error.message.includes("HTTP error")) {
        throw new LicenseValidationError("License validation failed");
      }
      throw new LicenseError("Failed to check license", error);
    }
  }

  /**
   * Helper method to get mock expiration dates for development override
   */
  private static getMockExpirationDate(
    type: "trial" | "trial_expired" | "once" | "yearly" | "yearly_expired"
  ): string | null {
    switch (type) {
      case "trial":
        // Trial expires in 7 days
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case "trial_expired":
        // Trial expired yesterday
        return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      case "once":
        // Once license never expires
        return null;
      case "yearly":
        // Yearly expires in 1 year
        return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      case "yearly_expired":
        // Yearly license expired yesterday
        return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  }

  static async isLicenseModalDismissed(): Promise<boolean> {
    try {
      return (
        (await getStoreValue<boolean>(LICENSE_MODAL_DISMISSED_KEY)) || false
      );
    } catch (error) {
      console.error("Error checking license modal dismissal:", error);
      return false;
    }
  }

  static async setLicenseModalDismissed(dismissed: boolean): Promise<void> {
    try {
      await setStoreValue(LICENSE_MODAL_DISMISSED_KEY, dismissed);
    } catch (error) {
      console.error("Error setting license modal dismissal:", error);
    }
  }

  /**
   * Adds a license key from a deep link
   * @param licenseKey The license key to add
   * @returns The updated license
   */
  static async addLicenseFromDeepLink(
    licenseKey: string
  ): Promise<StoredLicense> {
    try {
      const validatedLicense = await this.validateLicense(licenseKey);
      await setStoreValue(LICENSE_KEY, validatedLicense);
      return validatedLicense;
    } catch (error) {
      throw new LicenseError("Failed to add license from deep link", error);
    }
  }
}
