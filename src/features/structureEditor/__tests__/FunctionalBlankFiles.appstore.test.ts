import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_IS_APPSTORE", "true");

vi.mock("@/api/store", () => ({
  getStoreValue: vi.fn(async (key: string) =>
    key === "createFunctionalBlankFiles" ? true : null
  ),
}));

const pathMocks = vi.hoisted(() => ({
  appCacheDir: vi.fn(async () => "/AppCache/FileArchitect"),
  documentDir: vi.fn(async () => "/Documents"),
  join: vi.fn(async (...segments: string[]) => segments.join("/")),
}));

vi.mock("@tauri-apps/api/path", () => ({
  resolve: async (...segments: string[]) => segments.join("/"),
  dirname: async (path: string) => {
    const index = path.lastIndexOf("/");
    return index > 0 ? path.slice(0, index) : "/";
  },
  homeDir: async () => "/home/test",
  documentDir: pathMocks.documentDir,
  appCacheDir: pathMocks.appCacheDir,
  join: pathMocks.join,
  extname: async (path: string) => {
    const match = path.match(/\.[^./]+$/);
    return match ? match[0] : "";
  },
}));

const appFsMock = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  readBinaryFile: vi.fn(),
  writeBinaryFile: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/structureEditor/utils/fs", () => ({
  __esModule: true,
  default: appFsMock,
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("files.json")) {
      return {
        ok: true,
        json: async () => ({ files: [{ type: "docx" }] }),
      } as any;
    }

    return {
      status: 200,
      arrayBuffer: async () =>
        new TextEncoder().encode("DOCX_TEMPLATE_BYTES").buffer,
    } as any;
  }),
}));

describe("functional blank files in Mac App Store builds", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    pathMocks.appCacheDir.mockResolvedValue("/AppCache/FileArchitect");
    pathMocks.documentDir.mockResolvedValue("/Documents");
    pathMocks.join.mockImplementation(async (...segments: string[]) =>
      segments.join("/")
    );
  });

  it("caches downloaded blank files under the app cache directory", async () => {
    const { createFolders } = await import(
      "@/features/structureEditor/utils/structureCreation"
    );

    await createFolders("project\n\tfile.docx", "/base", []);

    expect(pathMocks.appCacheDir).toHaveBeenCalled();
    expect(pathMocks.documentDir).not.toHaveBeenCalled();
    expect(pathMocks.join).toHaveBeenCalledWith(
      "/AppCache/FileArchitect",
      "BlankFiles"
    );
  });
});
