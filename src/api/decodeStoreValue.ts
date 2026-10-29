import { decrypt } from "@/utils/encryption";

const stringKeys = new Set([
  "machineId",
  "app_version",
  "defaultPath",
  "aiNamingStyle",
  "structureClickBehavior",
]);
const booleanKeys = new Set([
  "hasVisitedBefore",
  "autoOpenFolder",
  "createFunctionalBlankFiles",
  "licenseModalDismissed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStoredLicense(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.uuid === "string" &&
    ["trial", "once", "yearly"].includes(String(value.type)) &&
    (value.expires_at === null || typeof value.expires_at === "string") &&
    typeof value.last_checked_at === "string"
  );
}

function hasExpectedType(key: string, value: unknown): boolean {
  if (key === "license") return isStoredLicense(value);
  if (key === "machine") return isRecord(value);
  if (stringKeys.has(key)) return typeof value === "string";
  if (booleanKeys.has(key)) return typeof value === "boolean";
  return true;
}

export async function decodeStoreValue<T>(key: string, raw: unknown): Promise<T | null> {
  if (raw == null) return null;

  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(await decrypt(raw));
    } catch {
      try {
        // Older stores may contain unencrypted JSON values.
        value = JSON.parse(raw);
      } catch {
        // Preserve only known legacy plain-string settings, never a license.
        if (key === "license") throw new Error("Invalid stored license data");
        value = stringKeys.has(key) ? raw : null;
      }
    }
  }

  if (value === null) return null;
  if (!hasExpectedType(key, value)) {
    if (key === "license") {
      // Do not overwrite a possibly recoverable paid license with a new trial.
      throw new Error("Invalid stored license data");
    }
    return null;
  }
  return value as T;
}
