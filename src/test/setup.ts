import { vi } from "vitest";

// Mock import.meta.env
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_LICENSE_CHECK_GRACE_PERIOD_HOURS: "72",
    },
  },
});
