import {
  LicenseEntitlements,
  SetappRuntimeStatus,
  LicenseSource,
  StoredLicense,
} from "./types";

export function isSetappBuild(): boolean {
  return import.meta.env.VITE_IS_SETAPP === "true";
}

export function shouldUseSetappEntitlement(
  license: StoredLicense | null | undefined
): boolean {
  return isSetappBuild() || isSetappLicense(license);
}

function isActiveAt(date: string | null, now = new Date()): boolean {
  if (date === null) {
    return false;
  }

  return new Date(date) > now;
}

export function getLicenseSource(
  license: StoredLicense | null | undefined
): LicenseSource {
  if (!license) {
    return "direct";
  }

  if (license.source) {
    return license.source;
  }

  return license.type === "trial" ? "trial" : "direct";
}

export function isSetappLicense(
  license: StoredLicense | null | undefined
): boolean {
  return getLicenseSource(license) === "setapp";
}

export function createSetappLicense(
  lastCheckedAt = new Date().toISOString()
): StoredLicense {
  return {
    uuid: "setapp-license",
    source: "setapp",
    type: "once",
    license_key: null,
    expires_at: null,
    ai_expires_at: null,
    updates_expires_at: null,
    last_checked_at: lastCheckedAt,
    purchase_type: null,
    setapp_status: {
      enabled: true,
      available: true,
      active: true,
      source: "setapp",
      purchase_type: null,
      expiration_date: null,
    },
  };
}

export function createSetappLicenseFromStatus(
  status: SetappRuntimeStatus,
  lastCheckedAt = new Date().toISOString()
): StoredLicense {
  return {
    uuid: "setapp-license",
    source: "setapp",
    type: "once",
    license_key: null,
    expires_at: status.expiration_date,
    ai_expires_at: null,
    updates_expires_at: null,
    last_checked_at: lastCheckedAt,
    purchase_type: status.purchase_type,
    setapp_status: status,
  };
}

export function getLicenseEntitlements(
  license: StoredLicense | null | undefined,
  now = new Date()
): LicenseEntitlements {
  const source = getLicenseSource(license);

  if (!license) {
    return {
      source,
      hasCoreAccess: false,
      hasAiAccess: false,
      canManageLicense: false,
      isNonExpiringCoreAccess: false,
    };
  }

  if (source === "setapp") {
    const isActive = license.setapp_status?.active ?? true;

    return {
      source,
      hasCoreAccess: isActive,
      hasAiAccess: false,
      canManageLicense: false,
      isNonExpiringCoreAccess: isActive,
    };
  }

  const hasCoreAccess =
    license.expires_at === null || isActiveAt(license.expires_at, now);
  const hasAiAccess = isActiveAt(license.ai_expires_at, now);

  return {
    source,
    hasCoreAccess,
    hasAiAccess,
    canManageLicense: true,
    isNonExpiringCoreAccess: hasCoreAccess && license.expires_at === null,
  };
}
