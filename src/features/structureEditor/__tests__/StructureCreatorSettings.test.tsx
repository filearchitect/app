import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredLicense } from "@/features/auth/types";

const authMocks = vi.hoisted(() => ({
  license: {
    uuid: "direct-license",
    source: "direct",
    type: "yearly",
    license_key: "license-key",
    expires_at: null,
    ai_expires_at: null,
    updates_expires_at: null,
    last_checked_at: "2026-04-01T00:00:00.000Z",
  } as StoredLicense,
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuthContext: () => ({
    license: authMocks.license,
  }),
}));

vi.mock("@/features/structures/StructureContext", () => ({
  useStructures: () => ({
    activeStructure: null,
  }),
}));

vi.mock("../context/StructureEditorContext", () => ({
  useStructureEditor: () => ({
    baseDir: "/Users/test/Desktop",
    setBaseDir: vi.fn(),
    handleBrowse: vi.fn(),
    replacements: [{ search: "", replace: "", replaceInFiles: true, replaceInFolders: true }],
    setReplacements: vi.fn(),
  }),
}));

import { StructureCreatorSettings } from "../components/StructureCreatorSettings";

describe("StructureCreatorSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.license = {
      uuid: "direct-license",
      source: "direct",
      type: "yearly",
      license_key: "license-key",
      expires_at: null,
      ai_expires_at: null,
      updates_expires_at: null,
      last_checked_at: "2026-04-01T00:00:00.000Z",
    };
  });

  it("shows the AI button for a direct build with AI access", () => {
    render(<StructureCreatorSettings onAiGenerate={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Generate structure with AI" })
    ).toBeInTheDocument();
  });

  it("hides the AI button for Setapp access", () => {
    authMocks.license = {
      uuid: "setapp-license",
      source: "setapp",
      type: "once",
      license_key: null,
      expires_at: null,
      ai_expires_at: null,
      updates_expires_at: null,
      last_checked_at: "2026-04-01T00:00:00.000Z",
      purchase_type: "single_app",
      setapp_status: {
        enabled: true,
        available: true,
        active: true,
        source: "setapp",
        purchase_type: "single_app",
        expiration_date: null,
      },
    };

    render(<StructureCreatorSettings onAiGenerate={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Generate structure with AI" })
    ).not.toBeInTheDocument();
  });
});
