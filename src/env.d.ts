/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_LICENSE_CHECK_GRACE_PERIOD_HOURS: string;
  readonly VITE_DEEPINFRA_API_KEY: string;
  readonly VITE_OVERRIDE_LICENSE?:
    | "none"
    | "trial"
    | "trial_expired"
    | "once"
    | "yearly"
    | "yearly_expired";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
