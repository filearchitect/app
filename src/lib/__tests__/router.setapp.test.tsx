import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  useAuthContext: vi.fn(),
}));

const setappMock = vi.hoisted(() => ({
  isAppStoreBuild: vi.fn(),
  isSetappBuild: vi.fn(),
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuthContext: authMock.useAuthContext,
}));

vi.mock("@/features/auth/setapp", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth/setapp")>(
    "@/features/auth/setapp"
  );

  return {
    ...actual,
    isAppStoreBuild: setappMock.isAppStoreBuild,
    isSetappBuild: setappMock.isSetappBuild,
  };
});

vi.mock("@/features/structureEditor", () => ({
  StructureEditorPage: () => <div>Structure editor</div>,
}));

vi.mock("@/pages/preferences/PreferencesLayout", () => ({
  default: () => (
    <div>
      Preferences layout
      <Outlet />
    </div>
  ),
}));

vi.mock("@/pages/preferences/AccountPreferences", () => ({
  default: () => <div>Account preferences page</div>,
}));

vi.mock("@/pages/preferences/AIPreferences", () => ({
  default: () => <div>AI preferences page</div>,
}));

vi.mock("@/pages/preferences/GeneralPreferences", () => ({
  default: () => <div>General preferences page</div>,
}));

vi.mock("@/pages/preferences/HelpPreferences", () => ({
  default: () => <div>Help preferences page</div>,
}));

describe("Setapp preferences routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setappMock.isAppStoreBuild.mockReturnValue(false);
    setappMock.isSetappBuild.mockReturnValue(false);
  });

  it("redirects /preferences/ai to account in Setapp builds", async () => {
    authMock.useAuthContext.mockReturnValue({
      license: {
        source: "setapp",
        type: "once",
        ai_expires_at: null,
        expires_at: null,
        updates_expires_at: null,
        license_key: null,
        uuid: "setapp",
        last_checked_at: new Date().toISOString(),
        purchase_type: "single_app",
        setapp_status: {
          enabled: true,
          available: true,
          active: true,
          source: "setapp",
          purchase_type: "single_app",
          expiration_date: null,
        },
      },
    });

    const { Router } = await import("../router");

    render(
      <MemoryRouter initialEntries={["/preferences/ai"]}>
        <Router />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Account preferences page")
    ).toBeInTheDocument();
    expect(screen.queryByText("AI preferences page")).not.toBeInTheDocument();
  });

  it("keeps /preferences/ai available in direct builds", async () => {
    authMock.useAuthContext.mockReturnValue({
      license: {
        source: "direct",
        type: "once",
        ai_expires_at: new Date(Date.now() + 60_000).toISOString(),
        expires_at: null,
        updates_expires_at: null,
        license_key: "license-key",
        uuid: "direct",
        last_checked_at: new Date().toISOString(),
      },
    });

    const { Router } = await import("../router");

    render(
      <MemoryRouter initialEntries={["/preferences/ai"]}>
        <Router />
      </MemoryRouter>
    );

    expect(await screen.findByText("AI preferences page")).toBeInTheDocument();
  });

  it("redirects /preferences/ai to account in Mac App Store builds", async () => {
    setappMock.isAppStoreBuild.mockReturnValue(true);
    authMock.useAuthContext.mockReturnValue({
      license: {
        source: "appstore",
        type: "once",
        ai_expires_at: null,
        expires_at: null,
        updates_expires_at: null,
        license_key: null,
        uuid: "appstore",
        last_checked_at: new Date().toISOString(),
      },
    });

    const { Router } = await import("../router");

    render(
      <MemoryRouter initialEntries={["/preferences/ai"]}>
        <Router />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Account preferences page")
    ).toBeInTheDocument();
    expect(screen.queryByText("AI preferences page")).not.toBeInTheDocument();
  });
});
