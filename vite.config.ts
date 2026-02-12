/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  process.env.VITEST = mode === "test" ? "true" : "false";
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
        {
          find: "path",
          replacement: "path-browserify",
        },
      ],
      dedupe: [
        // Ensure only one copy of React is ever bundled so that
        // the UI package and the local app share the same instance.
        "react",
        "react-dom",
        "path-browserify",
        "react-simple-code-editor",
        "@filearchitect/core",
      ],
      mainFields: ["browser", "module", "main"],
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: env.TAURI_DEV_HOST || false,
      hmr: env.TAURI_DEV_HOST
        ? {
            protocol: "ws",
            host: env.TAURI_DEV_HOST,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
      force: true, // Force dependency pre-bundling
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
      // Tauri supports es2021
      target: ["es2022", "chrome100", "safari15"],
      // don't minify for debug builds
      minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
      // produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_DEBUG,
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
        defaultIsModuleExports: "auto",
      },
      rollupOptions: {
        output: {
          globals: {
            path: "pathBrowserify",
          },
          manualChunks: {
            editor: ["react-simple-code-editor"],
          },
        },
        external: ["fsevents"],
      },
    },
    esbuild: {
      target: "es2022",
    },
    define: {
      "process.env.VITE_APP_URL": JSON.stringify(process.env.VITE_APP_URL),
      "process.env.VITE_APP_ENV": JSON.stringify(process.env.VITE_APP_ENV),
      "process.env.VITE_TRIAL_CODE": JSON.stringify(
        process.env.VITE_TRIAL_CODE
      ),
      "process.env.VITE_PURCHASED_CODE": JSON.stringify(
        process.env.VITE_PURCHASED_CODE
      ),
    },
    optimizeDeps: {
      include: ["path-browserify", "react-simple-code-editor"],
      exclude: ["path", "fsevents"],
      esbuildOptions: {
        target: "es2022",
        platform: "browser",
      },
      // Disable caching for @filearchitect/core
      entries: [
        "src/**/*.{ts,tsx}",
        "node_modules/@filearchitect/core/**/*.{js,ts}",
      ],
      force: true,
    },
    test: {
      globals: true,
      environment: "node",
      setupFiles: ["./src/test/vitest.setup.ts"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      deps: {
        interopDefault: true,
        moduleDirectories: ["node_modules"],
        fallbackCJS: true,
      },
      mockReset: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/cypress/**",
        "**/.{idea,git,cache,output,temp}/**",
      ],
      env: {
        ...env,
      },
    },
  };
});
