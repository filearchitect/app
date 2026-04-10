export interface ServerMachineResponse {
  data: {
    name: string;
    created_at: string;
    updated_at: string;
    license: ServerLicense;
  };
}

export type LicenseSource = "direct" | "trial" | "setapp";
export type SetappPurchaseType = "membership" | "single_app";

export interface SetappRuntimeStatus {
  enabled: boolean;
  available: boolean;
  active: boolean;
  source: "setapp";
  purchase_type: SetappPurchaseType | null;
  expiration_date: string | null;
}

export interface ServerLicense {
  uuid: string;
  license_key: string | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  ai_expires_at: string | null;
  updates_expires_at: string | null;
  type: "trial" | "once" | "yearly";
  updated_at: string;
  machine_id?: string;
}

export interface StoredLicense {
  uuid: string;
  source?: LicenseSource;
  type: "trial" | "once" | "yearly";
  license_key: string | null;
  expires_at: string | null;
  ai_expires_at: string | null;
  updates_expires_at: string | null;
  last_checked_at: string;
  purchase_type?: SetappPurchaseType | null;
  setapp_status?: SetappRuntimeStatus;
}

export interface LicenseEntitlements {
  source: LicenseSource;
  hasCoreAccess: boolean;
  hasAiAccess: boolean;
  canManageLicense: boolean;
  isNonExpiringCoreAccess: boolean;
}

export interface SetappOverrideSettings {
  enabled?: boolean;
  available?: boolean;
  active?: boolean;
  purchaseType?: SetappPurchaseType | null;
  expirationDate?: string | null;
}
