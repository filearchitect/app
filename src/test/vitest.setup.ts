/// <reference types="vitest" />

import "@testing-library/jest-dom";
import { randomFillSync } from "crypto";
import { JSDOM } from "jsdom";
import { loadEnv } from "vite";
import { afterEach, vi } from "vitest";

// Set up JSDOM
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost:3000",
  pretendToBeVisual: true,
});

// Set up the global environment to mimic a browser environment
Object.defineProperties(global, {
  window: {
    value: dom.window,
    writable: true,
  },
  document: {
    value: dom.window.document,
    writable: true,
  },
  navigator: {
    value: dom.window.navigator,
    writable: true,
  },
});

// Set up TextEncoder/TextDecoder
if (!global.TextEncoder) {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Load test environment variables
const env = loadEnv("test", process.cwd(), "");

// Set up global environment variables for tests
Object.keys(env).forEach((key) => {
  if (key.startsWith("VITE_")) {
    const envKey = key.replace("VITE_", "");
    vi.stubGlobal(`import.meta.env.${key}`, env[key]);
  }
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Mock window.crypto for tests
if (typeof window !== "undefined") {
  Object.defineProperty(window, "crypto", {
    value: {
      getRandomValues: (buffer: any) => randomFillSync(buffer),
    },
    configurable: true,
  });
}

// Mock filesystem adapter
const mockFs = {
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(""),
  copyFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
};

// Mock store
const mockStore = {
  get: vi.fn().mockImplementation((key: string) => {
    if (key === "defaultPath") {
      return Promise.resolve("/test/path");
    }
    if (key === "autoOpenFolder") {
      return Promise.resolve(true);
    }
    return Promise.resolve(null);
  }),
  set: vi.fn().mockResolvedValue(undefined),
  save: vi.fn().mockResolvedValue(undefined),
  load: vi.fn().mockResolvedValue(undefined),
  path: "test.json",
  clear: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  has: vi.fn().mockResolvedValue(true),
  reset: vi.fn().mockResolvedValue(undefined),
  entries: vi.fn().mockResolvedValue([]),
};

// Mock auto updater
const mockHandleUpdate = vi.fn().mockImplementation(async () => {
  return Promise.resolve();
});

const mockUseAutoUpdater = vi.fn().mockReturnValue({
  handleUpdate: mockHandleUpdate,
  isUpdating: false,
  showUpdateDialog: false,
  updateInfo: null,
});

// Mock structure context
const mockUseStructures = vi.fn().mockReturnValue({
  structures: [],
  editorContent: "",
  setEditorContent: vi.fn(),
  handleSaveStructure: vi.fn(),
  deleteStructure: vi.fn(),
  handleUpdateStructure: vi.fn(),
});

// Mock modules
vi.mock("@/api/store", () => ({
  getStore: () => Promise.resolve(mockStore),
  STORE_PATH: "test.json",
}));

// Don't mock @filearchitect/core, we want to use the real implementation
vi.unmock("@filearchitect/core");

vi.mock("@/features/structures/StructureContext", () => ({
  useStructures: mockUseStructures,
}));

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn().mockResolvedValue("1.0.0"),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue("/selected/path"),
}));

vi.mock("@tauri-apps/api/fs", () => mockFs);

vi.mock("@tauri-apps/api/tauri", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === "get_desktop_dir") {
      return Promise.resolve("/Users/test/Desktop");
    }
    return Promise.resolve(null);
  }),
}));

vi.mock("@/hooks/useStructures", () => ({
  useStructures: mockUseStructures,
}));

vi.mock("@/hooks/useAutoUpdater", () => ({
  useAutoUpdater: mockUseAutoUpdater,
}));
