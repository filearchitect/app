/// <reference types="vitest" />
import path from "path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  process.env.VITEST = "true";
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      setupFiles: ["./src/test/vitest.setup.ts"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      deps: {
        // This tells Vitest to mock these modules during testing
        interopDefault: true,
        moduleDirectories: ["node_modules"],
        fallbackCJS: true,
      },
      // Mock external modules that can't be bundled
      mockReset: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/cypress/**",
        "**/.{idea,git,cache,output,temp}/**",
      ],
      env: {
        ...env, // Use the loaded environment variables
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Mock Tauri modules with empty modules during testing
        "@tauri-apps/api/fs": path.resolve(
          __dirname,
          "./src/test/mocks/empty.ts"
        ),
        "@tauri-apps/api/tauri": path.resolve(
          __dirname,
          "./src/test/mocks/empty.ts"
        ),
        "@tauri-apps/api/dialog": path.resolve(
          __dirname,
          "./src/test/mocks/empty.ts"
        ),
      },
    },
  };
});
