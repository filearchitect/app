export interface ServerMachineResponse {
  data: {
    name: string;
    created_at: string;
    updated_at: string;
    license: ServerLicense;
  };
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
  type: "trial" | "once" | "yearly";
  license_key: string | null;
  expires_at: string | null;
  ai_expires_at: string | null;
  updates_expires_at: string | null;
  last_checked_at: string;
}
