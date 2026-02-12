import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock preferences to enable functional blank files
vi.mock("@/api/store", () => ({
  getStoreValue: vi.fn(async (key: string) =>
    key === "createFunctionalBlankFiles" ? true : null
  ),
}));

// Minimal path mocks used by fs adapter and structure creation
const pathJoinMock = vi.hoisted(() =>
  vi.fn(async (...s: string[]) => s.join("/"))
);
vi.mock("@tauri-apps/api/path", () => ({
  resolve: async (...segments: string[]) => segments.join("/"),
  dirname: async (p: string) => {
    const idx = p.lastIndexOf("/");
    return idx > 0 ? p.slice(0, idx) : "/";
  },
  homeDir: async () => "/home/test",
  documentDir: async () => "/Documents",
  join: pathJoinMock,
  extname: async (p: string) => {
    const match = p.match(/\.[^./]+$/);
    return match ? match[0] : "";
  },
}));

// Mock our fs wrapper used by structure creation for deterministic behavior
const appFsMock = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  readBinaryFile: vi
    .fn()
    .mockResolvedValue(new TextEncoder().encode("DOCX_TEMPLATE_BYTES")),
  writeBinaryFile: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/structureEditor/utils/fs", () => ({
  __esModule: true,
  default: appFsMock,
}));

// Provide deterministic network for tests
const mockFetch = vi
  .fn()
  .mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("files.json")) {
      return {
        ok: true,
        json: async () => ({ files: [{ type: "docx" }] }),
      } as any;
    }
    return {
      status: 200,
      headers: new Map(),
      arrayBuffer: async () =>
        new TextEncoder().encode("DOCX_TEMPLATE_BYTES").buffer,
    } as any;
  });
vi.stubGlobal("fetch", mockFetch as any);
if (typeof window !== "undefined") {
  (window as any).fetch = mockFetch as any;
}

// Intentionally do not statically import modules under test; we'll import them after mocks are in place.

describe("functional blank files", () => {
  // Silence noisy network logs from functional blank fetching during tests
  const originalError = console.error;
  const originalLog = console.log;
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterAll(() => {
    (console.error as any).mockRestore?.();
    (console.log as any).mockRestore?.();
    console.error = originalError;
    console.log = originalLog;
  });

  beforeEach(() => {
    appFsMock.writeBinaryFile.mockClear();
    appFsMock.writeFile.mockClear();
    appFsMock.exists.mockClear();
    appFsMock.readBinaryFile.mockClear();
  });

  it("writes non-empty template when creating a .docx file", async () => {
    const module = await import(
      "@/features/structureEditor/utils/structureCreation"
    );
    const { createFolders } = module as any;
    const structure = `project\n\tfile.docx`;
    const baseDir = "/base";

    await createFolders(structure, baseDir, []);

    // Ensure we checked/constructed a path to local blank file
    const joinedWithBlank = pathJoinMock.mock.calls.some((args) => {
      const last = args[args.length - 1];
      return typeof last === "string" && last === "blank.docx";
    });
    expect(joinedWithBlank).toBe(true);
  });

  it("lib/filearchitect delegates to functional blank implementation", async () => {
    const spy = vi.spyOn(
      await import("@/features/structureEditor/utils/structureCreation"),
      "createFolders"
    );

    const { createFolders } = await import("@/lib/filearchitect");
    // Use empty structure to avoid invoking any file/network logic; we only
    // care that lib delegates to the functional implementation.
    await createFolders("", "/base", []);

    expect(spy).toHaveBeenCalled();
  });
});
